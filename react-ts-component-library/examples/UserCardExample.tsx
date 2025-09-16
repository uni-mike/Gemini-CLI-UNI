import React from 'react';
import { UserCard } from '../src/components/UserCard';

/**
 * Example usage of the UserCard component
 * Demonstrates various props and configurations
 */
const UserCardExample: React.FC = () => {
  const handleUserClick = () => {
    console.log('User card clicked!');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>UserCard Component Examples</h1>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        {/* Basic UserCard */}
        <UserCard
          name="John Doe"
          email="john.doe@example.com"
          avatar="https://via.placeholder.com/50"
          role="Software Engineer"
        />

        {/* UserCard with click handler */}
        <UserCard
          name="Jane Smith"
          email="jane.smith@example.com"
          avatar="https://via.placeholder.com/50"
          role="Product Manager"
          onClick={handleUserClick}
        />

        {/* UserCard with different role */}
        <UserCard
          name="Bob Johnson"
          email="bob.johnson@example.com"
          avatar="https://via.placeholder.com/50"
          role="UX Designer"
        />
      </div>

      <div style={{ marginTop: '30px' }}>
        <h2>Usage Code:</h2>
        <pre style={{
          backgroundColor: '#f4f4f4',
          padding: '15px',
          borderRadius: '5px',
          overflowX: 'auto'
        }}>
{`import { UserCard } from './components/UserCard';

// Basic usage
<UserCard
  name="John Doe"
  email="john.doe@example.com"
  avatar="https://via.placeholder.com/50"
  role="Software Engineer"
/>

// With click handler
<UserCard
  name="Jane Smith"
  email="jane.smith@example.com"
  avatar="https://via.placeholder.com/50"
  role="Product Manager"
  onClick={() => console.log('Clicked!')}
/>`}
        </pre>
      </div>
    </div>
  );
};

export default UserCardExample;