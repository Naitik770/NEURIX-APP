import React from 'react';
import { useTranslation } from 'react-i18next';

export default function PlaceholderPage({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-6">
        <span className="text-4xl">🚧</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{name}</h1>
      <p className="text-gray-600 dark:text-gray-400 max-w-md">
        This page is currently under construction or was recently moved. We're working hard to bring it back!
      </p>
    </div>
  );
}
