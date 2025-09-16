import React from 'react';

/**
 * Interface for UserCard component props
 */
export interface UserCardProps {
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
  /** URL to user's avatar image */
  avatar: string;
  /** User's role or position */
  role: string;
  /** Optional click handler */
  onClick?: () => void;
}

/**
 * UserCard component displays user information with avatar, name, email, and role
 * @param {UserCardProps} props - Component props
 * @returns {JSX.Element} User card component
 *
 * @example
 * <UserCard
 *   name="John Doe"
 *   email="john.doe@example.com"
 *   avatar="/path/to/avatar.jpg"
 *   role="Software Engineer"
 * />
 */
export const UserCard: React.FC<UserCardProps> = ({
  name,
  email,
  avatar,
  role,
  onClick
}) => {
  return (
    <div 
      className="user-card" 
      onClick={onClick}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '16px',
        margin: '8px',
        cursor: onClick ? 'pointer' : 'default',
        maxWidth: '300px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <img
          src={avatar}
          alt={`${name}'s avatar`}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            marginRight: '12px'
          }}
        />
        <div>
          <h3 style={{ margin: '0 0 '4px' 0, fontSize: '18px' }}>{name}</h3>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{role}</p>
        </div>
      </div>
      <p style={{ margin: 0, color: '#007bff', fontSize: '14px' }}>{email}</p>
    </div>
  );
};

export default UserCard;