// src/components/AnimatedBackground.tsx
export function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-20 -left-16 h-72 w-72 rounded-full blur-3xl opacity-30 animate-pulse"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, #6366F1 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full blur-3xl opacity-30 animate-[pulse_5s_ease-in-out_infinite]"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, #22D3EE 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute top-1/3 left-1/3 h-64 w-64 rounded-full blur-3xl opacity-20 animate-[spin_30s_linear_infinite]"
        style={{
          background:
            "conic-gradient(from 0deg, #F59E0B, #EF4444, #8B5CF6, #F59E0B)",
        }}
      />
    </div>
  );
}
