const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let plants = [];
let nextId = 1;

// Get all plants
app.get('/plants', (req, res) => {
  res.json(plants);
});

// Get plant by ID
app.get('/plants/:id', (req, res) => {
  const plant = plants.find(p => p.id === parseInt(req.params.id));
  if (!plant) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  res.json(plant);
});

// Create new plant
app.post('/plants', (req, res) => {
  const { name, species, wateringSchedule } = req.body;
  if (!name || !species) {
    return res.status(400).json({ error: 'Name and species are required' });
  }
  
  const newPlant = {
    id: nextId++,
    name,
    species,
    wateringSchedule: wateringSchedule || 'Weekly',
    lastWatered: new Date()
  };
  
  plants.push(newPlant);
  res.status(201).json(newPlant);
});

// Update plant
app.put('/plants/:id', (req, res) => {
  const plant = plants.find(p => p.id === parseInt(req.params.id));
  if (!plant) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  
  const { name, species, wateringSchedule } = req.body;
  if (name) plant.name = name;
  if (species) plant.species = species;
  if (wateringSchedule) plant.wateringSchedule = wateringSchedule;
  
  res.json(plant);
});

// Water plant
app.patch('/plants/:id/water', (req, res) => {
  const plant = plants.find(p => p.id === parseInt(req.params.id));
  if (!plant) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  
  plant.lastWatered = new Date();
  res.json(plant);
});

// Delete plant
app.delete('/plants/:id', (req, res) => {
  const index = plants.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Plant not found' });
  }
  
  plants.splice(index, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});