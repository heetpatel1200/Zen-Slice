import React from 'react';
import GameCanvas from './components/GameCanvas';

const App: React.FC = () => {
  return (
    <div className="w-full h-full">
      <GameCanvas />
    </div>
  );
};

export default App;