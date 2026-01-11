
import { GoogleGenAI, Type } from "@google/genai";
import { FootprintData, ValidationReport } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const DATA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    packageType: { type: Type.STRING },
    pinCount: { type: Type.NUMBER },
    units: { type: Type.STRING },
    dimensions: {
      type: Type.OBJECT,
      properties: {
        bodyWidth: { type: Type.OBJECT, properties: { nominal: { type: Type.NUMBER } } },
        bodyLength: { type: Type.OBJECT, properties: { nominal: { type: Type.NUMBER } } },
        pitch: { type: Type.OBJECT, properties: { nominal: { type: Type.NUMBER } } },
        leadWidth: { type: Type.OBJECT, properties: { nominal: { type: Type.NUMBER } } },
        leadLength: { type: Type.OBJECT, properties: { nominal: { type: Type.NUMBER } } },
      }
    },
    pinNumbering: {
      type: Type.OBJECT,
      properties: {
        direction: { type: Type.STRING },
        pin1Location: { type: Type.STRING }
      }
    },
    assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
    kicadMod: { type: Type.STRING, description: "Full KiCad .kicad_mod file content. MUST BE MULTI-LINE AND PRETTY-PRINTED." },
    stepScript: { type: Type.STRING, description: "OpenSCAD script for 3D model. MUST BE MULTI-LINE." },
    component: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        manufacturer: { type: Type.STRING },
        package: { type: Type.STRING }
      }
    },
    pins: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pin_number: { type: Type.STRING },
          pin_name: { type: Type.STRING },
          electrical_type: { type: Type.STRING },
          description: { type: Type.STRING }
        }
      }
    },
    symbol: {
      type: Type.OBJECT,
      properties: {
        kicad_symbol_text: { type: Type.STRING, description: "Full KiCad .kicad_sym file content. MUST BE MULTI-LINE AND INDENTED." }
      }
    }
  },
  required: ["packageType", "pinCount", "kicadMod", "stepScript", "pins", "symbol"]
};

const VALIDATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ["PASS", "FAIL"] },
    errors: { type: Type.ARRAY, items: { type: Type.STRING } },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    traceability: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pin_number: { type: Type.STRING },
          pin_name: { type: Type.STRING },
          footprint_pad: { type: Type.STRING },
          electrical_type: { type: Type.STRING },
          status: { type: Type.STRING, enum: ["MATCH", "MISMATCH", "MISSING"] }
        },
        required: ["pin_number", "pin_name", "footprint_pad", "electrical_type", "status"]
      }
    }
  },
  required: ["status", "errors", "warnings", "traceability"]
};

async function validateConsistency(
  generatedData: FootprintData,
  fileParts: any[]
): Promise<ValidationReport> {
  const prompt = `
    You are an AI system named "EDA Consistency Validator".
    Your mission is to validate the electrical and structural consistency between the generated Schematic Symbol, PCB Footprint, and the source datasheet.

    ==================================================
    GENERATED BUNDLE FOR VALIDATION:
    ==================================================
    COMPONENT: ${generatedData.component?.name}
    PACKAGE: ${generatedData.packageType}
    PINS EXTRACTED: ${JSON.stringify(generatedData.pins)}
    KICAD_MOD (Fragment): ${generatedData.kicadMod.substring(0, 500)}...

    ==================================================
    VALIDATION RULES:
    ==================================================
    LEVEL 1 — SYMBOL ↔ FOOTPRINT
    - Pin numbers MUST match pads exactly.
    - Check for missing/extra pins.

    LEVEL 2 — ELECTRICAL ROLES
    - power_in must be valid.
    - not_connected (NC) must not be tied to active nets.

    LEVEL 4 — POWER & GROUND SANITY
    - Multiple grounds must be handled correctly.

    ==================================================
    OUTPUT:
    ==================================================
    Return a VALID JSON object matching the validation schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [...fileParts, { text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: VALIDATION_SCHEMA,
    }
  });

  return JSON.parse(response.text);
}

export async function analyzeDatasheet(
  fileBase64: string | null, 
  mimeType: string | null, 
  datasheetUrl: string,
  userNotes: string,
  meta: { libraryName: string, footprintName: string, modelName: string }
): Promise<{ data: FootprintData, sources?: any[] }> {
  const parts: any[] = [];
  
  if (fileBase64 && mimeType) {
    parts.push({ inlineData: { data: fileBase64.split(',')[1], mimeType } });
  }

  const generationPrompt = `
    You are an expert Electronic Engineer operating as both "Auto Footprint Generator" and "Schematic Symbol Auto Generator".
    Analyze the datasheet and generate production-ready KiCad assets.

    ${datasheetUrl ? `DATASHEET URL: ${datasheetUrl}` : ''}
    USER NOTES: ${userNotes}
    TARGET NAMES: Footprint: ${meta.footprintName}, Library: ${meta.libraryName}

    ==================================================
    IMPORTANT FORMATTING RULES:
    1. The .kicad_sym and .kicad_mod outputs MUST be multi-line and indented. 
    2. Do NOT collapse S-expressions into single lines.
    3. Every pad/pin definition should ideally be on its own line.
    ==================================================

    TASK 1: SCHEMATIC SYMBOL (KiCad 8+)
    1. Extract all pins (Number, Name, Type).
    2. Format: Generate a complete (symbol ...) S-expression with proper indentation.

    TASK 2: FOOTPRINT & 3D
    1. Generate .kicad_mod with pin 1 marker, indented S-expressions.
    2. Generate multi-line OpenSCAD script for STEP model.

    Return JSON matching the requested schema.
  `;

  parts.push({ text: generationPrompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: DATA_SCHEMA,
    }
  });

  if (!response.text) throw new Error("Failed to receive content.");

  let jsonData: FootprintData = JSON.parse(response.text);
  
  // Perform consistency check
  try {
    const report = await validateConsistency(jsonData, parts.filter(p => p.inlineData));
    jsonData.validationReport = report;
  } catch (e) {
    console.warn("Validation step failed, but generation was successful.", e);
  }

  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  return { data: jsonData, sources };
}
