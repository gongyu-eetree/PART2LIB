
export enum PackageType {
  QFN = 'QFN',
  QFP = 'QFP',
  SOP = 'SOP',
  SOT = 'SOT',
  DFN = 'DFN',
  BGA = 'BGA',
  TO = 'TO',
  OTHER = 'OTHER'
}

export interface Dimension {
  min?: number;
  max?: number;
  nominal?: number;
}

export interface PackageDimensions {
  bodyWidth: Dimension; // E
  bodyLength: Dimension; // D
  height: Dimension; // A
  pitch: Dimension; // e
  leadWidth: Dimension; // b
  leadLength: Dimension; // L
  padWidth?: Dimension;
  padLength?: Dimension;
  exposedPadWidth?: Dimension;
  exposedPadLength?: Dimension;
}

export interface PinInfo {
  pin_number: string;
  pin_name: string;
  electrical_type: 'input' | 'output' | 'bidirectional' | 'power_in' | 'power_out' | 'passive' | 'not_connected';
  description: string;
}

export interface ValidationReport {
  status: 'PASS' | 'FAIL';
  errors: string[];
  warnings: string[];
  traceability: Array<{
    pin_number: string;
    pin_name: string;
    footprint_pad: string;
    electrical_type: string;
    status: 'MATCH' | 'MISMATCH' | 'MISSING';
  }>;
}

export interface FootprintData {
  packageType: string;
  pinCount: number;
  dimensions: PackageDimensions;
  units: 'mm' | 'inch' | 'mil';
  pinNumbering: {
    direction: 'CCW' | 'CW';
    pin1Location: string;
  };
  recommendedLandPatternFound: boolean;
  assumptions: string[];
  missingFields: string[];
  kicadMod: string;
  stepScript: string;
  component?: {
    name: string;
    manufacturer: string;
    package: string;
  };
  pins?: PinInfo[];
  symbol?: {
    kicad_symbol_text: string;
  };
  validationReport?: ValidationReport;
}

export interface ProjectMetadata {
  libraryName: string;
  footprintName: string;
  modelName: string;
}
