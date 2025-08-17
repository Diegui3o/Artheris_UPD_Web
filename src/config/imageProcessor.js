import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const POOL_SIZE = 5;               // Número de procesos Python en paralelo
const MAX_QUEUE_SIZE = 10;         // Máximo número de imágenes esperando
const PROCESS_TIMEOUT_MS = 10000;  // Tiempo máximo por imagen

const workers = [];
let roundRobinIndex = 0;
const taskQueue = [];
let isInitialized = false;

// Inicialización diferida del pool de trabajadores
function initializeWorkers() {
    if (isInitialized) return;
    
    for (let i = 0; i < POOL_SIZE; i++) {
        workers.push(createWorker(i));
    }
    isInitialized = true;
    console.log(`✅ Iniciado pool de ${POOL_SIZE} trabajadores Python`);
}

// Inicializar en el próximo ciclo de eventos para asegurar que 'process' esté disponible
setImmediate(initializeWorkers);

function createWorker(id) {
    const scriptPath = path.join(__dirname, '..', 'server', 'pdi.py');
    // Access process inside the function to ensure it's available
    const pythonCmd = (() => {
        try {
            return process.platform === 'win32' ? 'python' : 'python3';
        } catch (e) {
            console.error('Error accessing process.platform, defaulting to python3');
            return 'python3';
        }
    })();
    
    const workerProcess = spawn(pythonCmd, [scriptPath]);
    console.log(`🐍 Worker[${id}] iniciado con comando: ${pythonCmd} ${scriptPath}`);

    const state = {
        id,
        process: workerProcess, // Use the local variable
        busy: false,
        buffer: '',
        currentTask: null,
    };

    workerProcess.stdout.on('data', (data) => {
        state.buffer += data.toString();

        let newlineIndex;
        while ((newlineIndex = state.buffer.indexOf('\n')) !== -1) {
            const message = state.buffer.slice(0, newlineIndex).trim();
            state.buffer = state.buffer.slice(newlineIndex + 1);

            if (state.currentTask) {
                try {
                    const result = JSON.parse(message);
                    state.currentTask.resolve(result);
                } catch (err) {
                    state.currentTask.reject(new Error(`JSON inválido del worker ${id}`));
                } finally {
                    state.currentTask = null;
                    state.busy = false;
                    scheduleNext();
                }
            }
        }
    });

    workerProcess.stderr.on('data', (data) => {
        console.error(`[Worker ${id} stderr]: ${data.toString()}`);
    });

    workerProcess.on('error', (err) => {
        console.error(`[Worker ${id}] error:`, err);
        state.busy = false;
    });

    workerProcess.on('exit', (code) => {
        console.error(`❌ Worker[${id}] terminó con código ${code}`);
        state.busy = false;
        
        // Rechazar cualquier tarea pendiente
        if (state.currentTask) {
            try {
                state.currentTask.reject(new Error(`Worker terminó inesperadamente con código ${code}`));
            } catch (e) {
                console.error('Error al rechazar tarea:', e);
            }
            state.currentTask = null;
        }
        
        // Reiniciar el worker después de un retraso
        setTimeout(() => {
            try {
                state.process = createWorker(id).process; // Reinicia
            } catch (e) {
                console.error(`Error al reiniciar worker ${id}:`, e);
            }
        }, 2000); // Aumentar el retraso para prevenir reinicios rápidos
    });

    return state;
}

function processImage(base64Image) {
    // Asegurarse de que los trabajadores estén inicializados
    if (!isInitialized) {
        initializeWorkers();
    }
    
    return new Promise((resolve, reject) => {
        if (taskQueue.length >= MAX_QUEUE_SIZE) {
            return reject(new Error('Demasiadas imágenes en espera'));
        }

        taskQueue.push({
            base64Image: (base64Image.split(',')[1] || base64Image).trim(),
            resolve,
            reject,
            timestamp: Date.now(),
        });

        scheduleNext();
    });
}

function scheduleNext() {
    const idleWorker = workers.find(w => !w.busy);
    if (!idleWorker || taskQueue.length === 0) return;

    const task = taskQueue.shift();
    if (!task) {
        return; // No task to process
    }

    // Validación rápida
    if (!task.base64Image || task.base64Image.length % 4 !== 0) {
        console.warn('Base64 inválido, descartando tarea');
        task.reject(new Error('Base64 inválido'));
        setImmediate(scheduleNext);
        return;
    }

    idleWorker.busy = true;
    idleWorker.currentTask = task;

    let timeout = null;
    
    // Función para limpiar el estado del worker
    const cleanup = () => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        idleWorker.busy = false;
        idleWorker.currentTask = null;
        setImmediate(scheduleNext);
    };

    // Timeout de seguridad
    timeout = setTimeout(() => {
        if (idleWorker.busy && idleWorker.currentTask) {
            console.warn(`⏰ Timeout en worker ${idleWorker.id}`);
            try {
                idleWorker.currentTask.reject(new Error('Timeout de procesamiento'));
            } catch (e) {
                console.error('Error al rechazar tarea:', e);
            }
            cleanup();
        }
    }, PROCESS_TIMEOUT_MS);

    // Guardar las funciones originales
    const originalResolve = task.resolve;
    const originalReject = task.reject;

    // Sobrescribir con manejo de limpieza
    task.resolve = (result) => {
        cleanup();
        originalResolve(result);
    };

    task.reject = (error) => {
        cleanup();
        originalReject(error);
    };

    idleWorker.process.stdin.write(task.base64Image + '\n');
}

process.on('exit', () => {
    for (const worker of workers) {
        worker.process.kill();
    }
});

// Función de compatibilidad para mantener la API existente
function startPythonProcess() {
    console.log('startPythonProcess() es obsoleto - El pool de trabajadores se inicia automáticamente');
    return {
        process: {
            on: () => {},
            stdin: { write: () => {} },
            kill: () => {}
        }
    };
}

export { processImage, startPythonProcess };
