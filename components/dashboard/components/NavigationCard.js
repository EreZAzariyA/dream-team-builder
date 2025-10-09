'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

/**
 * Clean navigation card component
 * Replaces the old GitHub launcher overlay
 */
const NavigationCard = ({ 
  icon: Icon, 
  title, 
  description, 
  href, 
  color = 'blue',
  count = null,
  isActive = false,
  onClick
}) => {
  const router = useRouter();

  const colorSchemes = {
    blue: {
      gradient: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      icon: 'text-blue-600 dark:text-blue-400'
    },
    purple: {
      gradient: 'from-purple-500 to-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-800',
      text: 'text-purple-700 dark:text-purple-300',
      icon: 'text-purple-600 dark:text-purple-400'
    },
    green: {
      gradient: 'from-green-500 to-green-600',
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
      icon: 'text-green-600 dark:text-green-400'
    },
    orange: {
      gradient: 'from-orange-500 to-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      text: 'text-orange-700 dark:text-orange-300',
      icon: 'text-orange-600 dark:text-orange-400'
    }
  };

  const scheme = colorSchemes[color] || colorSchemes.blue;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  };

  return (
    <motion.div
      className={`
        relative bg-white dark:bg-gray-800 rounded-xl border-2 
        ${isActive ? scheme.border : 'border-gray-200 dark:border-gray-700'}
        p-6 cursor-pointer transition-all duration-300 
        hover:shadow-lg hover:-translate-y-1
        group overflow-hidden
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
    >
      {/* Background gradient on hover */}
      <div className={`
        absolute inset-0 bg-gradient-to-br ${scheme.gradient} 
        opacity-0 group-hover:opacity-5 transition-opacity duration-300
      `} />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className={`
            p-3 rounded-lg ${scheme.bg} ${scheme.border} border
            group-hover:scale-110 transition-transform duration-300
          `}>
            <Icon className={`w-6 h-6 ${scheme.icon}`} />
          </div>
          
          {count !== null && (
            <div className={`
              px-3 py-1 rounded-full text-sm font-medium
              ${scheme.bg} ${scheme.text} ${scheme.border} border
            `}>
              {count}
            </div>
          )}
        </div>

        {/* Title and Description */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors">
          {description}
        </p>

        {/* Active indicator */}
        {isActive && (
          <div className="absolute -top-1 -right-1">
            <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${scheme.gradient} animate-pulse`} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default NavigationCard;