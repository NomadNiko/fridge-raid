// Crypto polyfill must be imported before AWS SDK
import 'react-native-get-random-values';

import { File } from 'expo-file-system';
import Constants from 'expo-constants';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';

// AWS Configuration from environment variables via app.config.js
const AWS_ACCESS_KEY_ID = Constants.expoConfig?.extra?.awsAccessKeyId || '';
const AWS_SECRET_ACCESS_KEY = Constants.expoConfig?.extra?.awsSecretAccessKey || '';
const AWS_REGION = Constants.expoConfig?.extra?.awsRegion || 'us-east-1';

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OCRResult {
  success: boolean;
  rawText: string;
  textBlocks: TextBlock[];
  error?: string;
}

// Create Textract client
function createTextractClient(): TextractClient | null {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return null;
  }

  return new TextractClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
}

// Convert image URI to Uint8Array bytes
async function imageToBytes(uri: string): Promise<Uint8Array> {
  try {
    const file = new File(uri);
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    throw new Error(`Failed to read image file: ${error}`);
  }
}

// Parse AWS Textract response into our format
function parseTextractResponse(response: any): OCRResult {
  try {
    const blocks = response.Blocks || [];

    if (blocks.length === 0) {
      return {
        success: true,
        rawText: '',
        textBlocks: [],
        error: 'No text detected in image',
      };
    }

    // Extract LINE blocks for structured text
    const lineBlocks = blocks.filter((block: any) => block.BlockType === 'LINE');

    // Build raw text from lines
    const rawText = lineBlocks.map((block: any) => block.Text || '').join('\n');

    // Convert to our TextBlock format
    const textBlocks: TextBlock[] = lineBlocks.map((block: any) => {
      const bbox = block.Geometry?.BoundingBox || {};
      return {
        text: block.Text || '',
        confidence: block.Confidence || 0,
        boundingBox: {
          x: bbox.Left || 0,
          y: bbox.Top || 0,
          width: bbox.Width || 0,
          height: bbox.Height || 0,
        },
      };
    });

    return {
      success: true,
      rawText,
      textBlocks,
    };
  } catch (error) {
    return {
      success: false,
      rawText: '',
      textBlocks: [],
      error: `Failed to parse Textract response: ${error}`,
    };
  }
}

// Main OCR function
export async function performOCR(imageUri: string): Promise<OCRResult> {
  // Check if AWS credentials are configured
  const client = createTextractClient();
  if (!client) {
    return {
      success: false,
      rawText: '',
      textBlocks: [],
      error:
        'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your environment.',
    };
  }

  try {
    // Convert image to bytes
    const imageBytes = await imageToBytes(imageUri);

    // Create Textract command
    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: imageBytes,
      },
    });

    // Call Textract
    const response = await client.send(command);

    return parseTextractResponse(response);
  } catch (error: any) {
    // Handle specific AWS errors
    if (error.name === 'InvalidParameterException') {
      return {
        success: false,
        rawText: '',
        textBlocks: [],
        error: 'Invalid image format. Please use JPEG or PNG.',
      };
    }

    if (error.name === 'UnsupportedDocumentException') {
      return {
        success: false,
        rawText: '',
        textBlocks: [],
        error: 'Unsupported document format. Please use a clear photo of the recipe.',
      };
    }

    if (error.name === 'ThrottlingException') {
      return {
        success: false,
        rawText: '',
        textBlocks: [],
        error: 'Too many requests. Please wait a moment and try again.',
      };
    }

    if (error.name === 'AccessDeniedException') {
      return {
        success: false,
        rawText: '',
        textBlocks: [],
        error: 'AWS access denied. Please check your credentials have Textract permissions.',
      };
    }

    // Handle network errors
    if (error.message?.includes('Network') || error.message?.includes('fetch')) {
      return {
        success: false,
        rawText: '',
        textBlocks: [],
        error: 'Network error. Please check your internet connection.',
      };
    }

    return {
      success: false,
      rawText: '',
      textBlocks: [],
      error: `OCR failed: ${error.message || error}`,
    };
  }
}

// Perform OCR with retry logic
export async function performOCRWithRetry(
  imageUri: string,
  maxRetries: number = 3
): Promise<OCRResult> {
  let lastError: OCRResult | null = null;

  for (let i = 0; i < maxRetries; i++) {
    const result = await performOCR(imageUri);

    if (result.success) {
      return result;
    }

    // Don't retry for configuration or permission errors
    if (
      result.error?.includes('credentials not configured') ||
      result.error?.includes('access denied') ||
      result.error?.includes('Invalid image format') ||
      result.error?.includes('Unsupported document')
    ) {
      return result;
    }

    lastError = result;

    // Exponential backoff: 1s, 2s, 4s
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  return (
    lastError || {
      success: false,
      rawText: '',
      textBlocks: [],
      error: 'OCR failed after multiple attempts',
    }
  );
}
