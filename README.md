# Smart Date Input

An intelligent React date/time input component with natural language parsing, smart suggestions, and confidence scoring.

## Features

- **Natural Language Processing**: Parse inputs like "tomorrow 7am", "next Friday", "in 3 days"
- **Smart Suggestions**: Context-aware autocomplete with confidence scoring
- **Real-time Parsing**: Instant feedback with confidence indicators
- **Calendar Integration**: Fallback to traditional date picker
- **Time Support**: Optional time input with smart parsing
- **Flexible Styling**: Customizable with CSS classes
- **Keyboard Navigation**: Arrow keys, Tab, Enter support
- **TypeScript Support**: Full type definitions included

## Installation

```bash
bun add @gabrielandrade/smart-date-input
# or
npm install @gabrielandrade/smart-date-input
# or
yarn add @gabrielandrade/smart-date-input
```

### Peer Dependencies

```bash
bun add react react-dom date-fns lucide-react
# or
npm install react react-dom date-fns lucide-react
```

## Quick Start

```tsx
import React, { useState } from 'react';
import { SmartDateInput } from '@gabrielandrade/smart-date-input';

function App() {
  const [date, setDate] = useState<number | null>(null);

  return (
    <SmartDateInput
      value={date}
      onChange={setDate}
      showTime={true}
      placeholder="When do you want to schedule this?"
    />
  );
}
```

## Natural Language Examples

The component understands various natural language inputs:

- **Relative dates**: "today", "tomorrow", "yesterday", "next week"
- **Specific weekdays**: "monday", "next friday", "this thursday"
- **Time expressions**: "7am", "2:30pm", "end of day"
- **Combined**: "tomorrow 10am", "next friday at 2pm"
- **Durations**: "in 3 days", "in a week", "2 days ago"
- **Month/date**: "Oct 15", "December 25", "12/25"

## API Reference

### SmartDateInput Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number \| null` | `null` | Timestamp value |
| `onChange` | `(value: number \| null) => void` | - | Change handler |
| `showTime` | `boolean` | `false` | Enable time input |
| `placeholder` | `string` | `"Enter date..."` | Input placeholder |
| `className` | `string` | `""` | Additional CSS classes |
| `disabled` | `boolean` | `false` | Disable input |

### Utility Functions

```tsx
import {
  parseSmartDateString,
  formatDateForDisplay,
  generateSmartSuggestions,
  getDueDateStatus
} from '@gabrielandrade/smart-date-input';

// Parse natural language
const result = parseSmartDateString("tomorrow 7am");
// { date: Date, confidence: 0.9, originalInput: "tomorrow 7am", ... }

// Format for display
const formatted = formatDateForDisplay(new Date(), "MMM dd, yyyy");
// "Jan 15, 2024"

// Generate suggestions
const suggestions = generateSmartSuggestions("tom", true);
// [{ label: "Tomorrow", value: "tomorrow", confidence: 1.0, ... }, ...]

// Get due date status
const status = getDueDateStatus(Date.now() + 86400000);
// { status: "due-soon", text: "Due tomorrow", className: "text-yellow-600" }
```

### Types

```tsx
interface DateParseResult {
  date: Date;
  confidence: number;
  originalInput: string;
  parsedComponents: {
    relative?: string;
    time?: string;
    weekday?: string;
    date?: string;
    modifiers?: string[];
  };
}

interface SmartSuggestion {
  label: string;
  value: string;
  confidence: number;
  preview: string;
  parsedDate?: Date;
  category: "relative" | "time" | "date" | "natural";
}
```

## Styling

The component is designed to work with Tailwind CSS classes but can be styled with any CSS framework:

```tsx
<SmartDateInput
  className="w-full border-2 border-blue-300 focus:border-blue-500"
  value={date}
  onChange={setDate}
/>
```

### Custom Styling Classes

The component uses these main CSS classes that you can override:
- Input container: Standard input styling
- Suggestions dropdown: `absolute z-50 w-full mt-1 bg-white border...`
- Confidence indicators: `text-green-600`, `text-yellow-600`, `text-orange-600`

## Advanced Usage

### With Custom UI Components

If you're using a different UI library, you'll need to replace the base components in the source:

```tsx
// Replace Button, Input, Calendar, Popover components
// with your preferred UI library components
```

### Confidence Scoring

The parser provides confidence scores (0-1) for each parse:
- 0.9+: High confidence (exact matches like "tomorrow")
- 0.7-0.9: Good confidence (weekdays, relative dates)
- 0.5-0.7: Medium confidence (month/date patterns)
- <0.5: Low confidence (fallback parsing)

### Date Validation

```tsx
const [date, setDate] = useState<number | null>(null);

const handleDateChange = (newDate: number | null) => {
  if (newDate && newDate < Date.now()) {
    // Handle past dates
    console.warn('Date is in the past');
  }
  setDate(newDate);
};
```

## Browser Support

- Modern browsers with ES2020 support
- React 16.8+ (hooks support)
- TypeScript 4.5+ (optional)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Credits

Built with:
- [date-fns](https://date-fns.org/) for date manipulation
- [Lucide React](https://lucide.dev/) for icons
- [React](https://reactjs.org/) for the component framework
