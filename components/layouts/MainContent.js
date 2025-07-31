const MainContent = ({ children }) => {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      {children}
    </main>
  );
};

export default MainContent;
