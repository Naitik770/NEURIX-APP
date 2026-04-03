import { useState } from 'react';
import { motion } from 'motion/react';

export default function LogicFlow({ onScore, isPlaying, level }: { onScore: (points: number) => void, isPlaying: boolean, level: number }) {
  const [sequence, setSequence] = useState([true, false, true]);

  const toggle = (index: number) => {
    if (!isPlaying) return;
    const newSequence = [...sequence];
    newSequence[index] = !newSequence[index];
    setSequence(newSequence);

    if (newSequence.every(val => val === true)) {
      onScore(25 * level);
      setSequence(Array.from({ length: 3 + level }, () => Math.random() > 0.5));
    }
  };

  return (
    <div className="flex gap-4">
      {sequence.map((val, i) => (
        <button
          key={i}
          onClick={() => toggle(i)}
          className={`w-16 h-16 rounded-xl ${val ? 'bg-orange-500' : 'bg-gray-300'}`}
          disabled={!isPlaying}
        />
      ))}
    </div>
  );
}
