
import React from 'react';

interface ErrorMessageProps {
  message: string;
  title?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, title = "Erro" }) => {
  if (!message) return null;

  return (
    <div className="bg-danger/10 border-l-4 border-danger text-danger p-4" role="alert">
      <p className="font-bold">{title}</p>
      <p className="whitespace-pre-wrap">{message}</p>
    </div>
  );
};

export default ErrorMessage;
