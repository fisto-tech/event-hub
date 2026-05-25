const LoadingSpinner = ({ label = 'Loading...', className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-12 gap-3 ${className}`}>
    <div className="w-10 h-10 border-4 border-crm-primary border-t-transparent rounded-full animate-spin" />
    <p className="text-sm text-gray-500">{label}</p>
  </div>
);

export default LoadingSpinner;
