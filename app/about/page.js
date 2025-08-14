
import React from 'react';
import BackToButton from '../../components/common/BackToButton';

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <BackToButton href="/auth/signin" label="Back to Sign-in" />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
            About Us
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400">
            We are a team of passionate developers and designers dedicated to creating innovative solutions that empower our users.
          </p>
        </div>

        <div className="mt-20">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center">Our Mission</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 text-center max-w-3xl mx-auto">
            Our mission is to build high-quality, user-centric applications that solve real-world problems. We believe in the power of technology to connect people, simplify complexity, and drive progress. We are committed to open-source and collaborative development.
          </p>
        </div>

        <div className="mt-20">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center">Meet the Team</h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Team Member 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
              <div className="mb-4">
                <img className="w-32 h-32 rounded-full mx-auto" src="https://i.pravatar.cc/150?img=1" alt="Team Member 1" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">John Doe</h3>
              <p className="text-md text-gray-500 dark:text-gray-400">Co-Founder & CEO</p>
            </div>

            {/* Team Member 2 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
              <div className="mb-4">
                <img className="w-32 h-32 rounded-full mx-auto" src="https://i.pravatar.cc/150?img=2" alt="Team Member 2" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Jane Smith</h3>
              <p className="text-md text-gray-500 dark:text-gray-400">Lead Designer</p>
            </div>

            {/* Team Member 3 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
              <div className="mb-4">
                <img className="w-32 h-32 rounded-full mx-auto" src="https://i.pravatar.cc/150?img=3" alt="Team Member 3" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Sam Wilson</h3>
              <p className="text-md text-gray-500 dark:text-gray-400">Lead Engineer</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AboutPage;
