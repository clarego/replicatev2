import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { InputProperty } from '../types/replicate';
import { MediaInput } from './MediaInput';
import { improvePrompt, OpenAIAPIError } from '../utils/openaiApi';
import { useMobileDetection } from '../hooks/useMobileDetection';

interface DynamicFormProps {
  schema: Record<string, InputProperty>;
  requiredFields: string[];
  initialValues?: Record<string, any>;
  onInputChange: (inputs: Record<string, any>) => void;
  modelContext?: string;
}

export function DynamicForm({ schema, requiredFields, initialValues, onInputChange, modelContext }: DynamicFormProps) {
  const { isMobile } = useMobileDetection();
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [improvingPrompt, setImprovingPrompt] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [lastSchema, setLastSchema] = useState<Record<string, InputProperty> | null>(null);
  const [lastInitialValues, setLastInitialValues] = useState<Record<string, any> | undefined>(undefined);

  // Reset initialization when schema changes (different model selected)
  useEffect(() => {
    if (lastSchema !== schema) {
      setIsInitialized(false);
      setLastSchema(schema);
      setLastInitialValues(initialValues);
    }
  }, [schema, lastSchema, initialValues]);

  // Detect when initialValues change from outside (e.g., "Use This Example" button)
  useEffect(() => {
    if (isInitialized && initialValues && initialValues !== lastInitialValues) {
      // Check if initialValues actually changed in content
      const hasChanged = JSON.stringify(initialValues) !== JSON.stringify(lastInitialValues);
      if (hasChanged) {
        console.log('DynamicForm: initialValues changed from outside, updating form');
        const defaults: Record<string, any> = {};
        Object.entries(schema).forEach(([key, prop]) => {
          if (prop.default !== undefined) {
            let defaultValue = prop.default;
            if (prop.type === 'string' && typeof defaultValue !== 'string') {
              defaultValue = String(defaultValue);
            }
            defaults[key] = defaultValue;
          }
        });
        const mergedInputs = { ...defaults, ...initialValues };
        setInputs(mergedInputs);
        onInputChange(mergedInputs);
        setLastInitialValues(initialValues);
      }
    }
  }, [initialValues, isInitialized, lastInitialValues, schema, onInputChange]);

  useEffect(() => {
    if (isInitialized) {
      return;
    }

    const defaults: Record<string, any> = {};
    Object.entries(schema).forEach(([key, prop]) => {
      if (prop.default !== undefined) {
        // Ensure default values respect the type from the schema
        let defaultValue = prop.default;
        if (prop.type === 'string' && typeof defaultValue !== 'string') {
          defaultValue = String(defaultValue);
        }
        defaults[key] = defaultValue;
      }
    });

    // Initialize inputs with defaults and any provided initial values
    const mergedInputs = { ...defaults, ...initialValues };
    console.log('DynamicForm initialized:', mergedInputs);
    setInputs(mergedInputs);
    onInputChange(mergedInputs);
    setIsInitialized(true);
    setLastInitialValues(initialValues);
  }, [schema, initialValues, isInitialized]);


  const handleChange = (key: string, value: any) => {
    const newInputs = { ...inputs, [key]: value };
    console.log('DynamicForm handleChange:', { key, value, newInputs });
    setInputs(newInputs);
    onInputChange(newInputs);
  };

  const handleImprovePrompt = async (key: string, currentValue: string) => {
    if (!currentValue || currentValue.trim().length === 0) {
      setPromptError('Please enter a prompt first');
      setTimeout(() => setPromptError(null), 3000);
      return;
    }

    setImprovingPrompt(key);
    setPromptError(null);

    try {
      const improved = await improvePrompt(currentValue, modelContext);
      handleChange(key, improved);
    } catch (error) {
      if (error instanceof OpenAIAPIError) {
        setPromptError(error.message);
      } else {
        setPromptError('Failed to improve prompt. Please try again.');
      }
      setTimeout(() => setPromptError(null), 5000);
    } finally {
      setImprovingPrompt(null);
    }
  };

  const sortedEntries = Object.entries(schema).sort((a, b) => {
    const orderA = a[1]['x-order'] ?? 999;
    const orderB = b[1]['x-order'] ?? 999;
    return orderA - orderB;
  });

  const renderInput = (key: string, prop: InputProperty, value: any, onChange: (key: string, value: any) => void) => {
    return renderInputField(key, prop, value, onChange, improvingPrompt, handleImprovePrompt, promptError, isMobile);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {sortedEntries.map(([key, prop]) => (
        <div key={key} className="space-y-1.5 sm:space-y-2">
          <label htmlFor={key} className="block text-xs sm:text-sm font-medium text-gray-700">
            {prop.title || key}
            {requiredFields.includes(key) && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </label>

          {prop.description && (
            <p className="text-[10px] sm:text-xs text-gray-500">{prop.description}</p>
          )}

          {renderInput(key, prop, inputs[key], handleChange)}
        </div>
      ))}
    </div>
  );
}

function getEnumValues(prop: InputProperty): (string | number)[] | null {
  if (prop.enum && prop.enum.length > 0) {
    return prop.enum;
  }

  if (prop.const !== undefined) {
    return [prop.const];
  }

  if (prop.allOf) {
    for (const item of prop.allOf) {
      if (item.enum && item.enum.length > 0) {
        return item.enum;
      }
      if (item.const !== undefined) {
        return [item.const];
      }
    }
  }

  if (prop.anyOf) {
    const enumValues: (string | number)[] = [];
    for (const item of prop.anyOf) {
      if (item.enum && item.enum.length > 0) {
        enumValues.push(...item.enum);
      }
      if (item.const !== undefined) {
        enumValues.push(item.const);
      }
    }
    if (enumValues.length > 0) {
      return enumValues;
    }
  }

  if (prop.oneOf) {
    const enumValues: (string | number)[] = [];
    for (const item of prop.oneOf) {
      if (item.enum && item.enum.length > 0) {
        enumValues.push(...item.enum);
      }
      if (item.const !== undefined) {
        enumValues.push(item.const);
      }
    }
    if (enumValues.length > 0) {
      return enumValues;
    }
  }

  return null;
}

function renderInputField(
  key: string,
  prop: InputProperty,
  value: any,
  onChange: (key: string, value: any) => void,
  improvingPrompt: string | null,
  handleImprovePrompt: (key: string, value: string) => void,
  promptError: string | null,
  isMobile: boolean = false
) {
  // Handle array types
  if (prop.type === 'array') {
    return <ArrayInput keyName={key} value={value} onChange={onChange} prop={prop} />;
  }

  const enumValues = getEnumValues(prop);

  if (enumValues && enumValues.length > 0) {
    console.log(`Enum field [${key}]:`, { enumValues, propType: prop.type, value });
    return (
      <select
        id={key}
        value={value ?? ''}
        onChange={(e) => {
          const selectedValue = e.target.value;
          const isNumeric = enumValues.every(v => typeof v === 'number');

          // If the schema explicitly says string, keep it as string
          let finalValue: string | number;
          if (prop.type === 'string') {
            finalValue = selectedValue;
          } else {
            finalValue = isNumeric ? parseFloat(selectedValue) : selectedValue;
          }

          console.log(`Enum change [${key}]:`, { selectedValue, isNumeric, propType: prop.type, finalValue });
          onChange(key, finalValue);
        }}
        className={`w-full ${isMobile ? 'px-3 py-2.5 text-base' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
      >
        {enumValues.length > 1 && <option value="">Select an option...</option>}
        {enumValues.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (prop.type === 'boolean') {
    return (
      <div className="flex items-center">
        <input
          type="checkbox"
          id={key}
          checked={value || false}
          onChange={(e) => onChange(key, e.target.checked)}
          className={`${isMobile ? 'w-6 h-6' : 'w-4 h-4'} text-blue-600 border-gray-300 rounded focus:ring-blue-500`}
        />
        <label htmlFor={key} className={`ml-2 ${isMobile ? 'text-base' : 'text-sm'} text-gray-600 cursor-pointer`}>
          {prop.description || 'Enable this option'}
        </label>
      </div>
    );
  }

  if (prop.type === 'integer' || prop.type === 'number') {
    const keyLowerForDimension = key.toLowerCase();
    const isDimensionField = keyLowerForDimension === 'width' || keyLowerForDimension === 'height';
    const isResolutionField = keyLowerForDimension === 'resolution';
    const isDurationField = keyLowerForDimension.includes('duration') ||
                           keyLowerForDimension.includes('length') ||
                           keyLowerForDimension.includes('seconds') ||
                           (keyLowerForDimension.includes('time') && !keyLowerForDimension.includes('timestamp'));
    const MAX_DIMENSION = 1440;
    const MAX_DURATION = 10;

    let effectiveMin = prop.minimum;
    let effectiveMax = prop.maximum;

    if (isDimensionField) {
      effectiveMax = effectiveMax !== undefined ? Math.min(effectiveMax, MAX_DIMENSION) : MAX_DIMENSION;
    }

    if (isDurationField) {
      effectiveMax = effectiveMax !== undefined ? Math.min(effectiveMax, MAX_DURATION) : MAX_DURATION;
    }

    // Handle resolution field with dropdown of common resolutions
    if (isResolutionField) {
      const resolutionOptions = [
        { value: 480, label: '480p (854x480)' },
        { value: 540, label: '540p (960x540)' },
        { value: 720, label: '720p HD (1280x720)' },
        { value: 1080, label: '1080p Full HD (1920x1080)' },
        { value: 1440, label: '1440p 2K (2560x1440)' }
      ].filter(opt => {
        // Filter based on min/max if specified
        if (effectiveMin !== undefined && opt.value < effectiveMin) return false;
        if (effectiveMax !== undefined && opt.value > effectiveMax) return false;
        return true;
      });

      return (
        <select
          id={key}
          value={value ?? prop.default ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange(key, val);
          }}
          className={`w-full ${isMobile ? 'px-3 py-2.5 text-base' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        >
          <option value="">Select resolution...</option>
          {resolutionOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (isDimensionField) {
      const standardValues = keyLowerForDimension === 'width'
        ? [320, 640, 854, 1024, 1280, 1440, 1920]
        : [240, 480, 512, 720, 768, 1080, 1440];

      return (
        <select
          id={key}
          value={value ?? prop.default ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange(key, val);
          }}
          className={`w-full ${isMobile ? 'px-3 py-2.5 text-base' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        >
          <option value="">Select {keyLowerForDimension}...</option>
          {standardValues.map((dimValue) => (
            <option key={dimValue} value={dimValue}>
              {dimValue}px
            </option>
          ))}
        </select>
      );
    }

    const hasRange = effectiveMin !== undefined && effectiveMax !== undefined;
    const useSlider = hasRange && (effectiveMax - effectiveMin) <= 2000;

    if (useSlider) {
      const clampValue = (val: number): number => {
        if (isNaN(val)) return effectiveMin;

        // Clamp to effective min/max from slider
        if (effectiveMin !== undefined && val < effectiveMin) {
          val = effectiveMin;
        }
        if (effectiveMax !== undefined && val > effectiveMax) {
          val = effectiveMax;
        }

        return val;
      };

      return (
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <input
              type="range"
              id={`${key}-slider`}
              value={value ?? prop.default ?? effectiveMin}
              onChange={(e) => {
                let val = prop.type === 'integer'
                  ? parseInt(e.target.value, 10)
                  : parseFloat(e.target.value);
                val = clampValue(val);
                onChange(key, val);
              }}
              min={effectiveMin}
              max={effectiveMax}
              step={prop.type === 'integer' ? 1 : 0.01}
              className={`flex-1 ${isMobile ? 'h-4' : 'h-2'} bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600`}
            />
            <input
              type="number"
              id={key}
              value={value ?? prop.default ?? ''}
              onChange={(e) => {
                const inputVal = e.target.value;
                if (inputVal === '' || inputVal === '-') {
                  onChange(key, '');
                  return;
                }

                let val = prop.type === 'integer'
                  ? parseInt(inputVal, 10)
                  : parseFloat(inputVal);

                // Allow typing but don't update if invalid
                if (isNaN(val)) {
                  onChange(key, '');
                  return;
                }

                // Clamp the value
                val = clampValue(val);
                onChange(key, val);
              }}
              onBlur={(e) => {
                // On blur, ensure value is within bounds
                const inputVal = e.target.value;
                if (inputVal === '' || inputVal === '-') {
                  onChange(key, effectiveMin);
                  return;
                }

                let val = prop.type === 'integer'
                  ? parseInt(inputVal, 10)
                  : parseFloat(inputVal);

                if (isNaN(val)) {
                  onChange(key, effectiveMin);
                  return;
                }

                val = clampValue(val);
                onChange(key, val);
              }}
              min={effectiveMin}
              max={effectiveMax}
              step={prop.type === 'integer' ? 1 : 0.01}
              className={`${isMobile ? 'w-20 px-3 py-2.5 text-base' : 'w-16 sm:w-24 px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center`}
            />
          </div>
          <p className={`${isMobile ? 'text-xs' : 'text-[10px] sm:text-xs'} text-gray-500`}>
            Range: {effectiveMin} to {effectiveMax}
            {isDimensionField && <span className="ml-1 text-amber-600 font-medium">(Max: {MAX_DIMENSION}px for cost control)</span>}
            {isDurationField && <span className="ml-1 text-amber-600 font-medium">(Max: {MAX_DURATION}s for cost control)</span>}
          </p>
        </div>
      );
    }

    const clampStandaloneValue = (val: number): number => {
      if (isNaN(val)) return effectiveMin ?? 0;

      // Clamp to effective min/max
      if (effectiveMin !== undefined && val < effectiveMin) {
        val = effectiveMin;
      }
      if (effectiveMax !== undefined && val > effectiveMax) {
        val = effectiveMax;
      }

      return val;
    };

    return (
      <div className="space-y-1">
        <input
          type="number"
          id={key}
          value={value ?? prop.default ?? ''}
          onChange={(e) => {
            const inputVal = e.target.value;
            if (inputVal === '' || inputVal === '-') {
              onChange(key, '');
              return;
            }

            let val = prop.type === 'integer'
              ? parseInt(inputVal, 10)
              : parseFloat(inputVal);

            if (isNaN(val)) {
              onChange(key, '');
              return;
            }

            // Clamp the value
            val = clampStandaloneValue(val);
            onChange(key, val);
          }}
          onBlur={(e) => {
            // On blur, ensure value is within bounds
            const inputVal = e.target.value;
            if (inputVal === '' || inputVal === '-') {
              const defaultVal = effectiveMin ?? prop.default ?? 0;
              onChange(key, defaultVal);
              return;
            }

            let val = prop.type === 'integer'
              ? parseInt(inputVal, 10)
              : parseFloat(inputVal);

            if (isNaN(val)) {
              const defaultVal = effectiveMin ?? prop.default ?? 0;
              onChange(key, defaultVal);
              return;
            }

            val = clampStandaloneValue(val);
            onChange(key, val);
          }}
          min={effectiveMin}
          max={effectiveMax}
          step={prop.type === 'integer' ? 1 : 0.01}
          className={`w-full ${isMobile ? 'px-3 py-2.5 text-base' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        />
        {(effectiveMin !== undefined || effectiveMax !== undefined) && (
          <p className={`${isMobile ? 'text-xs' : 'text-[10px] sm:text-xs'} text-gray-500`}>
            Range: {effectiveMin ?? '−∞'} to {effectiveMax ?? '∞'}
            {isDimensionField && <span className="ml-1 text-amber-600 font-medium">(Max: {MAX_DIMENSION}px for cost control)</span>}
            {isDurationField && <span className="ml-1 text-amber-600 font-medium">(Max: {MAX_DURATION}s for cost control)</span>}
          </p>
        )}
      </div>
    );
  }

  const keyLower = key.toLowerCase();
  const descLower = prop.description?.toLowerCase() || '';

  if (keyLower.includes('prompt') || descLower.includes('prompt')) {
    const isImproving = improvingPrompt === key;
    return (
      <div className="space-y-2">
        <textarea
          id={key}
          value={value || ''}
          onChange={(e) => onChange(key, e.target.value)}
          rows={isMobile ? 4 : 3}
          placeholder="Enter your text prompt here..."
          className={`w-full ${isMobile ? 'px-3 py-2.5 text-base' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          disabled={isImproving}
        />
        <button
          type="button"
          onClick={() => handleImprovePrompt(key, value || '')}
          disabled={isImproving || !value}
          className={`flex items-center gap-2 ${isMobile ? 'px-4 py-3' : 'px-3 py-1.5'} ${isMobile ? 'text-base' : 'text-sm'} font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 active:from-purple-800 active:to-pink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
        >
          {isImproving ? (
            <>
              <Loader2 className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} animate-spin`} />
              Improving...
            </>
          ) : (
            <>
              <Sparkles className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
              Improve Prompt
            </>
          )}
        </button>
        {promptError && (
          <p className={`${isMobile ? 'text-sm' : 'text-xs'} text-red-600`}>{promptError}</p>
        )}
      </div>
    );
  }

  if (keyLower === 'aspect_ratio' || keyLower === 'aspectratio') {
    const commonRatios = ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'];
    const hasCommonRatio = commonRatios.includes(value);

    return (
      <div className="space-y-2">
        <div className={`grid ${isMobile ? 'grid-cols-3' : 'grid-cols-3 sm:flex'} gap-1.5 sm:gap-2`}>
          {commonRatios.map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => onChange(key, ratio)}
              className={`${isMobile ? 'px-3 py-2.5 text-sm' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm'} border rounded-lg font-medium transition-colors ${
                value === ratio
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
        <input
          type="text"
          id={key}
          value={value || ''}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder="Or enter custom ratio (e.g., 16:9)"
          className={`w-full ${isMobile ? 'px-3 py-2.5 text-base' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        />
      </div>
    );
  }

  const isActualMediaField =
    prop.format === 'uri' &&
    (keyLower.includes('image') ||
      keyLower.includes('video') ||
      keyLower.includes('audio') ||
      keyLower.includes('file')) &&
    !keyLower.includes('url') &&
    !keyLower.includes('link');

  if (isActualMediaField) {
    return <MediaInput keyName={key} value={value} onChange={onChange} prop={prop} />;
  }

  return (
    <input
      type="text"
      id={key}
      value={value || ''}
      onChange={(e) => onChange(key, e.target.value)}
      className={`w-full ${isMobile ? 'px-3 py-2.5 text-base' : 'px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
    />
  );
}

function ArrayInput({
  keyName,
  value,
  onChange,
  prop
}: {
  keyName: string;
  value: any;
  onChange: (key: string, value: any) => void;
  prop: InputProperty;
}) {
  const arrayValue = Array.isArray(value) && value.length > 0 ? value : [''];
  const itemProp = prop.items || { type: 'string', format: 'uri' };

  // Initialize with at least one item if empty
  useEffect(() => {
    if (!Array.isArray(value) || value.length === 0) {
      onChange(keyName, ['']);
    }
  }, []);

  const handleItemChange = (index: number, newValue: any) => {
    const newArray = [...arrayValue];
    newArray[index] = newValue;
    onChange(keyName, newArray);
  };

  const handleAddItem = () => {
    onChange(keyName, [...arrayValue, '']);
  };

  const handleRemoveItem = (index: number) => {
    const newArray = arrayValue.filter((_, i) => i !== index);
    onChange(keyName, newArray);
  };

  // Check if array items are media files
  const keyLower = keyName.toLowerCase();
  const descLower = prop.description?.toLowerCase() || '';
  const isMediaArray =
    itemProp.format === 'uri' &&
    (keyLower.includes('image') ||
      keyLower.includes('video') ||
      keyLower.includes('audio') ||
      keyLower.includes('file'));

  return (
    <div className="space-y-2 sm:space-y-3">
      {arrayValue.map((item, index) => (
        <div key={index} className="border border-gray-300 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-gray-700">
              Item {index + 1}
            </span>
            {arrayValue.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveItem(index)}
                className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium"
              >
                Remove
              </button>
            )}
          </div>
          {isMediaArray ? (
            <MediaInput
              keyName={`${keyName}-${index}`}
              value={item}
              onChange={(_, newValue) => handleItemChange(index, newValue)}
              prop={itemProp}
            />
          ) : (
            <input
              type="text"
              value={item || ''}
              onChange={(e) => handleItemChange(index, e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={handleAddItem}
        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-xs sm:text-sm font-medium"
      >
        + Add Item
      </button>
    </div>
  );
}


