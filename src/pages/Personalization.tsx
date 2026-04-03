import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Check, User, Target, Brain } from 'lucide-react';

const STEPS = [
  { id: 'basic', title: 'Basic Info', icon: User },
  { id: 'personality', title: 'Personality', icon: Brain },
  { id: 'goals', title: 'Your Goals', icon: Target },
];

const PERSONALITY_TYPES = [
  'Analytical', 'Creative', 'Pragmatic', 'Idealistic', 'Adventurous', 'Disciplined'
];

const GOAL_OPTIONS = [
  'Improve Health', 'Career Growth', 'Learn New Skills', 'Better Relationships',
  'Financial Stability', 'Mental Well-being', 'Time Management', 'Creativity'
];

export default function Personalization() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    age: '',
    height: '',
    weight: '',
    personality: '',
    goals: [] as string[],
  });

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const toggleGoal = (goal: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal]
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...formData,
        age: parseInt(formData.age),
        height: parseInt(formData.height),
        weight: parseInt(formData.weight),
        updatedAt: serverTimestamp(),
      });
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    if (step === 0) return formData.age && formData.height && formData.weight;
    if (step === 1) return formData.personality;
    if (step === 2) return formData.goals.length > 0;
    return false;
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-gray-900 p-6 flex flex-col transition-colors duration-300">
      {/* Progress Bar */}
      <div className="flex gap-2 mb-12">
        {STEPS.map((s, i) => (
          <div 
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex-1"
        >
          <div className="mb-8">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-500 mb-4 transition-colors duration-300">
              {(() => {
                const Icon = STEPS[step].icon;
                return <Icon className="w-6 h-6" />;
              })()}
            </div>
            <h1 className="text-3xl font-serif text-gray-900 dark:text-white mb-2 transition-colors duration-300">{STEPS[step].title}</h1>
            <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300">Help NEURIX understand you better to provide personalized coaching.</p>
          </div>

          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors duration-300">Age</label>
                <input 
                  type="number"
                  value={formData.age}
                  onChange={e => setFormData({...formData, age: e.target.value})}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-300"
                  placeholder="How old are you?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors duration-300">Height (cm)</label>
                <input 
                  type="number"
                  value={formData.height}
                  onChange={e => setFormData({...formData, height: e.target.value})}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-300"
                  placeholder="Your height in cm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors duration-300">Weight (kg)</label>
                <input 
                  type="number"
                  value={formData.weight}
                  onChange={e => setFormData({...formData, weight: e.target.value})}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-300"
                  placeholder="Your weight in kg"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              {PERSONALITY_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setFormData({...formData, personality: type})}
                  className={`p-4 rounded-2xl border-2 transition-all duration-300 text-left ${formData.personality === type ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-200 dark:hover:border-orange-500/50'}`}
                >
                  <span className={`font-medium transition-colors duration-300 ${formData.personality === type ? 'text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>{type}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-3">
              {GOAL_OPTIONS.map(goal => (
                <button
                  key={goal}
                  onClick={() => toggleGoal(goal)}
                  className={`p-4 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between ${formData.goals.includes(goal) ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-200 dark:hover:border-orange-500/50'}`}
                >
                  <span className={`font-medium transition-colors duration-300 ${formData.goals.includes(goal) ? 'text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>{goal}</span>
                  {formData.goals.includes(goal) && <Check className="w-5 h-5 text-orange-500" />}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-12 flex gap-4">
        {step > 0 && (
          <button
            onClick={handleBack}
            className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={!isStepValid() || loading}
          className="flex-1 h-16 rounded-2xl bg-orange-500 text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 transition-all shadow-lg shadow-orange-500/20"
        >
          {loading ? 'Saving...' : step === STEPS.length - 1 ? 'Get Started' : 'Continue'}
          {!loading && <ChevronRight className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
}
