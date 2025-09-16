import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Add, Delete, Edit, WaterDrop } from '@mui/icons-material';

interface Plant {
  id?: number;
  name: string;
  type: string;
  lastWatered: string;
  wateringInterval: number;
  notes: string;
}

function App() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [open, setOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [formData, setFormData] = useState<Plant>({
    name: '',
    type: '',
    lastWatered: new Date().toISOString().split('T')[0],
    wateringInterval: 7,
    notes: ''
  });

  useEffect(() => {
    fetchPlants();
  }, []);

  const fetchPlants = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/plants');
      const data = await response.json();
      setPlants(data);
    } catch (error) {
      console.error('Error fetching plants:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingPlant 
        ? `http://localhost:3001/api/plants/${editingPlant.id}`
        : 'http://localhost:3001/api/plants';
      const method = editingPlant ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setOpen(false);
        setFormData({
          name: '',
          type: '',
          lastWatered: new Date().toISOString().split('T')[0],
          wateringInterval: 7,
          notes: ''
        });
        setEditingPlant(null);
        fetchPlants();
      }
    } catch (error) {
      console.error('Error saving plant:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`http://localhost:3001/api/plants/${id}`, { method: 'DELETE' });
      fetchPlants();
    } catch (error) {
      console.error('Error deleting plant:', error);
    }
  };

  const handleEdit = (plant: Plant) => {
    setEditingPlant(plant);
    setFormData(plant);
    setOpen(true);
  };

  const handleWater = async (plant: Plant) => {
    try {
      await fetch(`http://localhost:3001/api/plants/${plant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...plant,
          lastWatered: new Date().toISOString().split('T')[0]
        })
      });
      fetchPlants();
    } catch (error) {
      console.error('Error watering plant:', error);
    }
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <WaterDrop sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Plant Watering Manager
          </Typography>
          <Button 
            color="inherit" 
            startIcon={<Add />}
            onClick={() => setOpen(true)}
          >
            Add Plant
          </Button>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            My Plants
          </Typography>
          
          <List>
            {plants.map((plant) => (
              <ListItem 
                key={plant.id}
                secondaryAction={
                  <>
                    <IconButton 
                      edge="end" 
                      aria-label="water"
                      onClick={() => handleWater(plant)}
                      sx={{ mr: 1 }}
                    >
                      <WaterDrop />
                    </IconButton>
                    <IconButton 
                      edge="end" 
                      aria-label="edit"
                      onClick={() => handleEdit(plant)}
                      sx={{ mr: 1 }}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton 
                      edge="end" 
                      aria-label="delete"
                      onClick={() => handleDelete(plant.id!)}
                    >
                      <Delete />
                    </IconButton>
                  </>
                }
              >
                <ListItemText
                  primary={plant.name}
                  secondary={
                    `Type: ${plant.type} | Last watered: ${plant.lastWatered} | ` +
                    `Interval: ${plant.wateringInterval} days | Notes: ${plant.notes}`
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>
            {editingPlant ? 'Edit Plant' : 'Add New Plant'}
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Plant Name"
                fullWidth
                variant="outlined"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
              <TextField
                margin="dense"
                label="Plant Type"
                fullWidth
                variant="outlined"
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
              />
              <TextField
                margin="dense"
                label="Last Watered"
                type="date"
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                value={formData.lastWatered}
                onChange={(e) => setFormData({...formData, lastWatered: e.target.value})}
              />
              <TextField
                margin="dense"
                label="Watering Interval (days)"
                type="number"
                fullWidth
                variant="outlined"
                value={formData.wateringInterval}
                onChange={(e) => setFormData({...formData, wateringInterval: parseInt(e.target.value)})}
              />
              <TextField
                margin="dense"
                label="Notes"
                fullWidth
                variant="outlined"
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained">
                {editingPlant ? 'Update' : 'Add'} Plant
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Container>
    </>
  );
}

export default App;