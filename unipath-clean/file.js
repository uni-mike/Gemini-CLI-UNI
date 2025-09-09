```python
import unittest
from unittest.mock import patch, Mock
from weather import get_weather

class TestGetWeather(unittest.TestCase):
    @patch('requests.get')
    def test_successful_response(self, mock_get):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'weather': [{'description': 'clear sky'}],
            'main': {'temp': 22.5, 'humidity': 65},
            'name': 'London'
        }
        mock_get.return_value = mock_response
        
        result = get_weather('London', 'valid_api_key')
        self.assertEqual(result, {
            'city': 'London',
            'temperature': 22.5,
            'humidity': 65,
            'description': 'clear sky'
        })

    @patch('requests.get')
    def test_city_not_found(self, mock_get):
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.json.return_value = {'message': 'city not found'}
        mock_get.return_value = mock_response
        
        result = get_weather('InvalidCity', 'valid_api_key')
        self.assertEqual(result, {'error': 'City not found'})

    @patch('requests.get')
    def test_invalid_api_key(self, mock_get):
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.json.return_value = {'message': 'Invalid API key'}
        mock_get.return_value = mock_response
        
        result = get_weather('London', 'invalid_api_key')
        self.assertEqual(result, {'error': 'Invalid API key'})

    @patch('requests.get')
    def test_connection_error(self, mock_get):
        mock_get.side_effect = Exception("Connection error")
        
        result = get_weather('London', 'valid_api_key')
        self.assertEqual(result, {'error': 'Connection error'})

if __name__ == '__main__':
    unittest.main()
```