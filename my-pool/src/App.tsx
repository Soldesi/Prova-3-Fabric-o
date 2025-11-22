// src/App.tsx
import PoolSimulator from "./components/PoolSimulator";

export default function App() {
  return (
    <div style={{
      width: '100%',
      maxWidth: 1200,     // limita largura máxima para manter o layout legível
      margin: '0 auto',   // centraliza horizontalmente dentro do root
      boxSizing: 'border-box'
    }}>
      <PoolSimulator />
    </div>
  );
}
