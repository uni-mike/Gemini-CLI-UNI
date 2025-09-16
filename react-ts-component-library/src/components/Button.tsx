import React from 'react';

/**
 * Button variant types
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline';

/**
 * Button size types
 */
export type ButtonSize = 'small' | 'medium' | 'large';

/**
 * Interface for Button component props
 */
export interface ButtonProps {
  /** Button text content */
  children: React.ReactNode;
  /** Button variant style */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Click handler function */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** HTML button type attribute */
  type?: 'button' | 'submit' | 'reset';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Button component with multiple variants and sizes
 * @param {ButtonProps} props - Component props
 * @returns {JSX.Element} Button component
 *
 * @example
 * <Button variant="primary" size="large" onClick={() => console.log('Clicked')}>
 *   Click Me
 * </Button>
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  type = 'button',
  className = ''
}) => {
  const baseStyles = {
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s ease-in-out',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  };

  const variantStyles = {
    primary: {
      backgroundColor: disabled ? '#ccc' : '#007bff',
      color: 'white',
      border: 'none'
    },
    secondary: {
      backgroundColor: disabled ? '#ccc' : '#6c757d',
      color: 'white',
      border: 'none'
    },
    danger: {
      backgroundColor: disabled ? '#ccc' : '#dc3545',
      color: 'white',
      border: 'none'
    },
    success: {
      backgroundColor: disabled ? '#ccc' : '#28a745',
      color: 'white',
      border: 'none'
    },
    outline: {
      backgroundColor: 'transparent',
      color: disabled ? '#ccc' : '#007bff',
      border: '2px solid',
      borderColor: disabled ? '#ccc' : '#007bff'
    }
  };

  const sizeStyles = {
    small: {
      padding: '8px 16px',
      fontSize: '14px'
    },
    medium: {
      padding: '12px 24px',
      fontSize: '16px'
    },
    large: {
      padding: '16px 32px',
      fontSize: '18px'
    }
  };

  const buttonStyle = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
    opacity: disabled ? 0.6 : 1
  };

  return (
    <button
      type={type}
      style={buttonStyle}
      disabled={disabled}
      onClick={onClick}
      className={`button ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;