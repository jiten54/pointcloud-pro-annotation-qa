import { SemanticClassName } from '../types/pointcloud';

export interface ClassDefinition {
  name: SemanticClassName;
  id: number;
  label: string;
  color: string;
  defaultDimensions: [number, number, number]; // [length, width, height] in meters
  description: string;
}

export const SEMANTIC_CLASSES: Record<SemanticClassName, ClassDefinition> = {
  car: {
    name: 'car',
    id: 4,
    label: 'Car',
    color: '#3B82F6', // Blue
    defaultDimensions: [4.5, 1.9, 1.6],
    description: 'Standard passenger vehicles, sedans, hatchbacks, and SUVs.',
  },
  truck: {
    name: 'truck',
    id: 5,
    label: 'Truck',
    color: '#6366F1', // Indigo
    defaultDimensions: [8.5, 2.5, 3.2],
    description: 'Heavy duty cargo trucks, pickups, delivery vans, semi-tractors.',
  },
  bus: {
    name: 'bus',
    id: 6,
    label: 'Bus',
    color: '#8B5CF6', // Violet
    defaultDimensions: [11.5, 2.6, 3.4],
    description: 'Public transit buses, school buses, coaches.',
  },
  pedestrian: {
    name: 'pedestrian',
    id: 7,
    label: 'Pedestrian',
    color: '#EF4444', // Red
    defaultDimensions: [0.6, 0.6, 1.75],
    description: 'Upright human pedestrians, walking, jogging, or standing.',
  },
  cyclist: {
    name: 'cyclist',
    id: 8,
    label: 'Cyclist',
    color: '#F97316', // Orange
    defaultDimensions: [1.8, 0.7, 1.7],
    description: 'Bicycle rider mounted or pushing a bicycle.',
  },
  motorcycle: {
    name: 'motorcycle',
    id: 9,
    label: 'Motorcycle',
    color: '#EC4899', // Pink
    defaultDimensions: [2.1, 0.8, 1.3],
    description: 'Motorcycles, scooters, and mopeds with or without riders.',
  },
  road: {
    name: 'road',
    id: 1,
    label: 'Road',
    color: '#64748B', // Slate Gray
    defaultDimensions: [20.0, 10.0, 0.2],
    description: 'Drivable asphalt, road surfaces, lanes, and intersections.',
  },
  vegetation: {
    name: 'vegetation',
    id: 3,
    label: 'Vegetation',
    color: '#10B981', // Emerald Green
    defaultDimensions: [3.0, 3.0, 4.0],
    description: 'Trees, shrubs, hedges, bushes, roadside grass.',
  },
  building: {
    name: 'building',
    id: 2,
    label: 'Building',
    color: '#EAB308', // Amber
    defaultDimensions: [10.0, 10.0, 8.0],
    description: 'Building facades, walls, architectural structures.',
  },
  other: {
    name: 'other',
    id: 0,
    label: 'Other / Background',
    color: '#94A3B8', // Light Slate
    defaultDimensions: [2.0, 2.0, 2.0],
    description: 'Poles, traffic signs, barriers, debris, and unclassified background points.',
  },
};

export const CLASS_NAME_TO_ID: Record<SemanticClassName, number> = Object.entries(
  SEMANTIC_CLASSES
).reduce((acc, [key, val]) => {
  acc[key as SemanticClassName] = val.id;
  return acc;
}, {} as Record<SemanticClassName, number>);

export const ID_TO_CLASS_NAME: Record<number, SemanticClassName> = Object.entries(
  SEMANTIC_CLASSES
).reduce((acc, [key, val]) => {
  acc[val.id] = key as SemanticClassName;
  return acc;
}, {} as Record<number, SemanticClassName>);
