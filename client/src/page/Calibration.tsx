import LedControl from "./LedOption";
import MotorsControl from "./MotorsOption";
import SwitchControl from "./ModeSwitch";

const Calibration: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent mb-3">
            Panel de Control del Dron
          </h1>
          <div className="w-24 h-1.5 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300 max-w-2xl mx-auto text-lg">
            Ajusta y monitorea todos los sistemas del dron en tiempo real
          </p>
        </div>

        {/* Contenedor principal */}
        <div className="space-y-8">
          {/* Fila de controles */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Control de LEDs */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-blue-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10a1 1 0 01-1.64 0l-7-10A1 1 0 014 7h4V2a1 1 0 011.707-.708l1.593 1.593z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-white">LEDs</h2>
              </div>
              <div className="relative">
                <LedControl />
              </div>
            </div>

            {/* Control de Motores */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-blue-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-white">Motores</h2>
              </div>
              <div className="relative">
                <MotorsControl />
              </div>
            </div>

            {/* Modo de Conmutación */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-blue-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-white">Modo</h2>
              </div>
              <div className="relative">
                <SwitchControl />
              </div>
            </div>
          </div>

          {/* Sección de información adicional */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 mt-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h2a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Estado del Sistema
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-700/30 p-4 rounded-lg">
                <p className="text-sm text-gray-400">Estado de la Batería</p>
                <div className="flex items-center mt-1">
                  <div className="w-full bg-gray-600 rounded-full h-2.5">
                    <div
                      className="bg-green-500 h-2.5 rounded-full"
                      style={{ width: "85%" }}
                    ></div>
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-300">
                    85%
                  </span>
                </div>
              </div>
              <div className="bg-gray-700/30 p-4 rounded-lg">
                <p className="text-sm text-gray-400">Temperatura</p>
                <p className="text-lg font-semibold text-white">42°C</p>
              </div>
              <div className="bg-gray-700/30 p-4 rounded-lg">
                <p className="text-sm text-gray-400">Tiempo de Vuelo</p>
                <p className="text-lg font-semibold text-white">12:34 min</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calibration;
