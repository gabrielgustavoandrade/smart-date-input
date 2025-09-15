import {
	addDays,
	addMonths,
	endOfDay,
	format,
	formatDistanceToNow,
	isValid,
	setHours,
	setMinutes,
	startOfDay,
} from "date-fns";

export interface DateParseResult {
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

export interface SmartSuggestion {
	label: string;
	value: string;
	confidence: number;
	preview: string;
	parsedDate?: Date;
	category: "relative" | "time" | "date" | "natural";
}

// Enhanced natural language date parsing with confidence scoring
export const parseSmartDateString = (input: string): DateParseResult | null => {
	if (!input || input.trim() === "") {
		return null;
	}

	const trimmed = input.trim().toLowerCase();
	const now = new Date();
	let confidence = 0;
	let parsedDate: Date | null = null;
	const components: DateParseResult["parsedComponents"] = {};

	// Time parsing patterns
	const timePatterns = [
		// 7am, 7pm, 07:30, 7:30am, etc.
		/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
		/\b(\d{1,2}):(\d{2})\b/,
		/\b(\d{1,2})\s*(am|pm)\b/i,
	];

	let timeMatch: RegExpMatchArray | null = null;
	let extractedTime: { hours: number; minutes: number } | null = null;

	for (const pattern of timePatterns) {
		timeMatch = trimmed.match(pattern);
		if (timeMatch) {
			let hours = parseInt(timeMatch[1], 10);
			const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
			const ampm = timeMatch[3]?.toLowerCase();

			if (ampm === "pm" && hours !== 12) {
				hours += 12;
			} else if (ampm === "am" && hours === 12) {
				hours = 0;
			}

			if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
				extractedTime = { hours, minutes };
				components.time = timeMatch[0];
				confidence += 0.3;
			}
			break;
		}
	}

	// Remove time from input for date parsing
	const inputWithoutTime = timeMatch
		? trimmed.replace(timeMatch[0], "").trim()
		: trimmed;

	// Relative date patterns (high confidence)
	const relativePatterns = [
		{ pattern: /^(today|now)$/i, days: 0, confidence: 0.9 },
		{ pattern: /^tomorrow$/i, days: 1, confidence: 0.9 },
		{ pattern: /^yesterday$/i, days: -1, confidence: 0.9 },
		{ pattern: /^(next week|in a week)$/i, days: 7, confidence: 0.8 },
		{ pattern: /^(last week|a week ago)$/i, days: -7, confidence: 0.8 },
		{
			pattern: /^(next month|in a month)$/i,
			handler: () => addMonths(now, 1),
			confidence: 0.8,
		},
		{
			pattern: /^(last month|a month ago)$/i,
			handler: () => addMonths(now, -1),
			confidence: 0.8,
		},
		{
			pattern: /^in (\d+) days?$/i,
			handler: (match: RegExpMatchArray) =>
				addDays(now, parseInt(match[1], 10)),
			confidence: 0.85,
		},
		{
			pattern: /^(\d+) days? ago$/i,
			handler: (match: RegExpMatchArray) =>
				addDays(now, -parseInt(match[1], 10)),
			confidence: 0.85,
		},
		{
			pattern: /^(end of day|eod)$/i,
			handler: () => endOfDay(now),
			confidence: 0.7,
		},
		{
			pattern: /^(start of day|beginning of day)$/i,
			handler: () => startOfDay(now),
			confidence: 0.7,
		},
	];

	for (const {
		pattern,
		days,
		handler,
		confidence: patternConf,
	} of relativePatterns) {
		const match = inputWithoutTime.match(pattern);
		if (match) {
			if (handler) {
				parsedDate = handler(match);
			} else if (days !== undefined) {
				parsedDate = addDays(now, days);
			}
			components.relative = match[0];
			confidence += patternConf;
			break;
		}
	}

	// Weekday patterns
	if (!parsedDate) {
		const weekdays = [
			"monday",
			"tuesday",
			"wednesday",
			"thursday",
			"friday",
			"saturday",
			"sunday",
		];
		const weekdayPattern = new RegExp(
			`^(next\\s+)?(${weekdays.join("|")})$`,
			"i",
		);
		const weekdayMatch = inputWithoutTime.match(weekdayPattern);

		if (weekdayMatch) {
			const isNext = !!weekdayMatch[1];
			const weekdayName = weekdayMatch[2].toLowerCase();
			const targetDayIndex = weekdays.indexOf(weekdayName);

			if (targetDayIndex !== -1) {
				const targetDay = targetDayIndex + 1; // 1 = Monday, 7 = Sunday
				const today = now.getDay() === 0 ? 7 : now.getDay();
				let daysUntilTarget = targetDay - today;

				if (isNext || daysUntilTarget <= 0) {
					daysUntilTarget += 7;
				}

				parsedDate = addDays(now, daysUntilTarget);
				components.weekday = weekdayMatch[0];
				confidence += isNext ? 0.85 : 0.8;
			}
		}
	}

	// Month/date patterns (Oct 15, Dec 25 at 3pm, etc.)
	if (!parsedDate) {
		const monthPatterns = [
			// "Oct 15", "October 15", "Oct 15 at", etc.
			/\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:\s+(?:at|@))?/i,
			// "15 Oct", "15 October"
			/\b(\d{1,2})\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)/i,
			// "12/25", "12-25"
			/\b(\d{1,2})[/-](\d{1,2})\b/,
		];

		for (const pattern of monthPatterns) {
			const match = inputWithoutTime.match(pattern);
			if (match) {
				try {
					let month: number;
					let day: number;

					if (pattern.toString().includes("jan|january")) {
						// Month name first
						const monthStr = match[1].toLowerCase();
						const monthNames = [
							"jan",
							"january",
							"feb",
							"february",
							"mar",
							"march",
							"apr",
							"april",
							"may",
							"jun",
							"june",
							"jul",
							"july",
							"aug",
							"august",
							"sep",
							"september",
							"oct",
							"october",
							"nov",
							"november",
							"dec",
							"december",
						];
						const monthIndex = monthNames.findIndex((name) =>
							monthStr.startsWith(name.substring(0, 3)),
						);
						month = Math.floor(monthIndex / 2); // Each month has 2 entries (short + long)
						day = parseInt(match[2], 10);
					} else if (match[2] && Number.isNaN(parseInt(match[2], 10))) {
						// Day first, then month name
						day = parseInt(match[1], 10);
						const monthStr = match[2].toLowerCase();
						const monthNames = [
							"jan",
							"january",
							"feb",
							"february",
							"mar",
							"march",
							"apr",
							"april",
							"may",
							"jun",
							"june",
							"jul",
							"july",
							"aug",
							"august",
							"sep",
							"september",
							"oct",
							"october",
							"nov",
							"november",
							"dec",
							"december",
						];
						const monthIndex = monthNames.findIndex((name) =>
							monthStr.startsWith(name.substring(0, 3)),
						);
						month = Math.floor(monthIndex / 2);
					} else {
						// Numeric format MM/DD or DD/MM
						month = parseInt(match[1], 10) - 1; // 0-based
						day = parseInt(match[2], 10);
					}

					if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
						const year = now.getFullYear();
						parsedDate = new Date(year, month, day);

						// If the date is in the past, assume next year
						if (parsedDate < now) {
							parsedDate = new Date(year + 1, month, day);
						}

						components.date = match[0];
						confidence += 0.75;
					}
				} catch (_error) {
					// Continue to next pattern
				}
				break;
			}
		}
	}

	// Fallback to standard date parsing
	if (!parsedDate) {
		try {
			const standardDate = new Date(input);
			if (isValid(standardDate) && !Number.isNaN(standardDate.getTime())) {
				parsedDate = standardDate;
				confidence += 0.5;
			}
		} catch (_error) {
			// Parsing failed
		}
	}

	if (!parsedDate) {
		return null;
	}

	// Apply extracted time
	if (extractedTime) {
		parsedDate = setHours(
			setMinutes(parsedDate, extractedTime.minutes),
			extractedTime.hours,
		);
	}

	// Ensure minimum confidence for valid results
	if (confidence < 0.3) {
		return null;
	}

	return {
		date: parsedDate,
		confidence: Math.min(confidence, 1.0),
		originalInput: input,
		parsedComponents: components,
	};
};

// Legacy function for backward compatibility
export const parseDateString = (dateString: string): Date | null => {
	const result = parseSmartDateString(dateString);
	return result ? result.date : null;
};

export const formatDateForInput = (date: Date, includeTime = false): string => {
	if (!isValid(date)) {
		return "";
	}

	if (includeTime) {
		return format(date, "yyyy-MM-dd HH:mm");
	}

	return format(date, "yyyy-MM-dd");
};

// Generate smart suggestions based on input
export const generateSmartSuggestions = (
	input: string,
	showTime = false,
): SmartSuggestion[] => {
	const suggestions: SmartSuggestion[] = [];
	const trimmed = input.trim().toLowerCase();
	const now = new Date();

	// If input is empty, show fewer, more relevant suggestions
	if (!trimmed) {
		const baseSuggestions = [
			{
				label: "Tomorrow",
				value: "tomorrow",
				category: "relative" as const,
				confidence: 1.0,
			},
			{
				label: "Next week",
				value: "next week",
				category: "relative" as const,
				confidence: 1.0,
			},
			{
				label: "Next Monday",
				value: "next monday",
				category: "relative" as const,
				confidence: 0.9,
			},
		];

		if (showTime) {
			// Only add a couple time suggestions when showTime is true
			baseSuggestions.push(
				{
					label: "Tomorrow 10am",
					value: "tomorrow 10am",
					category: "relative" as const,
					confidence: 0.9,
				},
				{
					label: "End of day",
					value: "end of day",
					category: "relative" as const,
					confidence: 0.8,
				},
			);
		}

		return baseSuggestions
			.map((s) => {
				const parseResult = parseSmartDateString(s.value);
				return {
					...s,
					preview: parseResult
						? formatDateForDisplay(
								parseResult.date,
								showTime ? "MMM dd 'at' h:mma" : "MMM dd, yyyy",
							)
						: s.label,
					parsedDate: parseResult?.date,
				};
			})
			.slice(0, 4); // Limit to 4 initial suggestions
	}

	// Parse current input to see if it's valid - prioritize exact matches
	const currentParse = parseSmartDateString(input);
	if (currentParse && currentParse.confidence > 0.5) {
		// Boost confidence for direct input matches to prioritize them
		const boostedConfidence = Math.min(currentParse.confidence + 0.2, 1.0);
		suggestions.push({
			label: `"${input}" → ${formatDateForDisplay(currentParse.date, showTime ? "MMM dd 'at' h:mma" : "MMM dd, yyyy")}`,
			value: input,
			confidence: boostedConfidence,
			preview: formatDateForDisplay(
				currentParse.date,
				showTime ? "MMM dd 'at' h:mma" : "MMM dd, yyyy",
			),
			parsedDate: currentParse.date,
			category: "natural",
		});
	}

	// Generate contextual suggestions based on partial input
	const contextualSuggestions: SmartSuggestion[] = [];

	// Time-based suggestions
	if (showTime) {
		const timeKeywords = [
			"am",
			"pm",
			":",
			"morning",
			"afternoon",
			"evening",
			"night",
		];
		if (timeKeywords.some((keyword) => trimmed.includes(keyword))) {
			// Generate proper suggestions with all required fields
			const timeSuggestionBases = [
				{ base: "today", times: ["9am", "12pm", "2pm", "5pm"] },
				{ base: "tomorrow", times: ["9am", "10am", "2pm", "3pm"] },
			];

			for (const { base, times } of timeSuggestionBases) {
				for (const time of times) {
					const suggestion = `${base} ${time}`;
					const parseResult = parseSmartDateString(suggestion);
					if (parseResult) {
						contextualSuggestions.push({
							label: `${base.charAt(0).toUpperCase() + base.slice(1)} ${time}`,
							value: suggestion,
							confidence: 0.85,
							category: "time",
							preview: formatDateForDisplay(
								parseResult.date,
								"MMM dd 'at' h:mma",
							),
							parsedDate: parseResult.date,
						});
					}
				}
			}
		}
	}

	// Month/date suggestions - only show if user hasn't typed a specific date
	const months = [
		"jan",
		"feb",
		"mar",
		"apr",
		"may",
		"jun",
		"jul",
		"aug",
		"sep",
		"oct",
		"nov",
		"dec",
	];
	const matchedMonths = months.filter(
		(month) => month.includes(trimmed) || trimmed.includes(month),
	);

	// Only add generic month suggestions if we don't have a good direct parse
	if (!currentParse || currentParse.confidence < 0.7) {
		for (const month of matchedMonths.slice(0, 1)) {
			// Reduced to 1 month max
			const monthIndex = months.indexOf(month);
			// Show fewer generic days - only 1st and 15th
			const daysToShow = [1, 15].filter(
				(day) =>
					day <= new Date(now.getFullYear(), monthIndex + 1, 0).getDate(),
			);

			for (const day of daysToShow) {
				const suggestion = `${month} ${day}`;
				const parseResult = parseSmartDateString(suggestion);
				if (parseResult && suggestion !== trimmed) {
					// Don't duplicate user input
					contextualSuggestions.push({
						label: `${month.charAt(0).toUpperCase() + month.slice(1)} ${day}`,
						value: suggestion,
						confidence: 0.65, // Lower confidence for generic suggestions
						category: "date" as const,
						preview: formatDateForDisplay(parseResult.date, "MMM dd, yyyy"),
						parsedDate: parseResult.date,
					});
				}
			}
		}
	}

	// Weekday suggestions
	const weekdays = [
		"monday",
		"tuesday",
		"wednesday",
		"thursday",
		"friday",
		"saturday",
		"sunday",
	];
	const matchedWeekdays = weekdays.filter(
		(day) => day.includes(trimmed) || trimmed.includes(day.substring(0, 3)),
	);

	for (const weekday of matchedWeekdays) {
		for (const prefix of ["", "next "]) {
			const suggestion = `${prefix}${weekday}`;
			const parseResult = parseSmartDateString(suggestion);
			if (parseResult) {
				contextualSuggestions.push({
					label: prefix
						? `Next ${weekday.charAt(0).toUpperCase() + weekday.slice(1)}`
						: weekday.charAt(0).toUpperCase() + weekday.slice(1),
					value: suggestion,
					confidence: prefix ? 0.85 : 0.8,
					category: "relative" as const,
					preview: formatDateForDisplay(parseResult.date, "MMM dd, yyyy"),
					parsedDate: parseResult.date,
				});

				// Add time variants for weekdays
				if (showTime) {
					for (const time of ["9am", "2pm", "5pm"]) {
						const timeVariant = `${suggestion} ${time}`;
						const timeParseResult = parseSmartDateString(timeVariant);
						if (timeParseResult) {
							contextualSuggestions.push({
								label: `${prefix ? "Next " : ""}${weekday.charAt(0).toUpperCase() + weekday.slice(1)} at ${time}`,
								value: timeVariant,
								confidence: (prefix ? 0.85 : 0.8) * 0.9,
								category: "time" as const,
								preview: formatDateForDisplay(
									timeParseResult.date,
									"MMM dd 'at' h:mma",
								),
								parsedDate: timeParseResult.date,
							});
						}
					}
				}
			}
		}
	}

	// Add contextual suggestions to main list
	suggestions.push(...contextualSuggestions.slice(0, 8));

	// Only add relative suggestions if we don't have a high-confidence current parse
	// This prevents irrelevant suggestions when user has typed something specific
	if (!currentParse || currentParse.confidence < 0.8) {
		// Relative suggestions based on input
		const relativeSuggestions = [
			{
				pattern: /today|now/,
				suggestions: [
					"today",
					"today 9am",
					"today 2pm",
					"today 5pm",
					"end of day",
				],
			},
			{
				pattern: /tomorrow|tom/,
				suggestions: [
					"tomorrow",
					"tomorrow 9am",
					"tomorrow 10am",
					"tomorrow 2pm",
				],
			},
			{
				pattern: /next|week/,
				suggestions: ["next week", "next monday", "next friday", "in 7 days"],
			},
			{
				pattern: /month/,
				suggestions: ["next month", "in 30 days", "end of month"],
			},
		];

		for (const {
			pattern,
			suggestions: relSuggestions,
		} of relativeSuggestions) {
			if (pattern.test(trimmed)) {
				for (const suggestion of relSuggestions.slice(0, 2)) {
					// Reduced from 3 to 2
					if (
						!showTime &&
						(suggestion.includes("am") || suggestion.includes("pm"))
					)
						continue;

					const parseResult = parseSmartDateString(suggestion);
					if (parseResult && !suggestions.some((s) => s.value === suggestion)) {
						suggestions.push({
							label: suggestion.charAt(0).toUpperCase() + suggestion.slice(1),
							value: suggestion,
							confidence: 0.8,
							category:
								suggestion.includes("am") || suggestion.includes("pm")
									? "time"
									: "relative",
							preview: formatDateForDisplay(
								parseResult.date,
								showTime &&
									(suggestion.includes("am") || suggestion.includes("pm"))
									? "MMM dd 'at' h:mma"
									: "MMM dd, yyyy",
							),
							parsedDate: parseResult.date,
						});
					}
				}
				break; // Only match the first pattern to avoid too many suggestions
			}
		}
	}

	// Sort by confidence and remove duplicates
	const filteredSuggestions = suggestions
		.filter(
			(suggestion, index, self) =>
				index === self.findIndex((s) => s.value === suggestion.value),
		)
		.filter((s) => !Number.isNaN(s.confidence) && s.confidence > 0) // Filter out invalid confidence values
		.sort((a, b) => b.confidence - a.confidence);

	// Smart filtering: if we have high confidence suggestions, don't show low confidence ones
	if (filteredSuggestions.length > 0) {
		const maxConfidence = filteredSuggestions[0].confidence;

		// If we have a very high confidence match (90%+), only show similar quality suggestions
		if (maxConfidence >= 0.9) {
			return filteredSuggestions
				.filter((s) => s.confidence >= 0.85)
				.slice(0, 3);
		}
		// If we have good confidence matches (70%+), filter out low confidence ones
		else if (maxConfidence >= 0.7) {
			return filteredSuggestions.filter((s) => s.confidence >= 0.6).slice(0, 5);
		}
		// Otherwise, show a reasonable number of suggestions
		else {
			return filteredSuggestions.slice(0, 6);
		}
	}

	return filteredSuggestions.slice(0, 8);
};

export const formatDateForDisplay = (
	date: Date | number,
	formatString = "MMM dd, yyyy",
): string => {
	const dateObj = typeof date === "number" ? new Date(date) : date;

	if (!isValid(dateObj)) {
		return "";
	}

	return format(dateObj, formatString);
};

export const formatRelativeTime = (date: Date | number): string => {
	const dateObj = typeof date === "number" ? new Date(date) : date;

	if (!isValid(dateObj)) {
		return "";
	}

	return formatDistanceToNow(dateObj, { addSuffix: true });
};

export const isOverdue = (dueDate: number | null | undefined): boolean => {
	if (!dueDate) return false;
	return dueDate < Date.now();
};

export const getDueDateStatus = (
	dueDate: number | null | undefined,
): {
	status: "overdue" | "due-today" | "due-soon" | "not-due" | "no-due-date";
	text: string;
	className: string;
} => {
	if (!dueDate) {
		return {
			status: "no-due-date",
			text: "No due date",
			className: "text-gray-500",
		};
	}

	const now = Date.now();
	const today = new Date();
	today.setHours(23, 59, 59, 999); // End of today
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	tomorrow.setHours(23, 59, 59, 999); // End of tomorrow

	if (dueDate < now) {
		return {
			status: "overdue",
			text: `Overdue ${formatRelativeTime(dueDate)}`,
			className: "text-red-600 font-medium",
		};
	}

	if (dueDate <= today.getTime()) {
		return {
			status: "due-today",
			text: "Due today",
			className: "text-orange-600 font-medium",
		};
	}

	if (dueDate <= tomorrow.getTime()) {
		return {
			status: "due-soon",
			text: "Due tomorrow",
			className: "text-yellow-600",
		};
	}

	return {
		status: "not-due",
		text: `Due ${formatDateForDisplay(dueDate, "MMM dd")}`,
		className: "text-gray-600",
	};
};

export const getDatePresets = (): Array<{
	label: string;
	value: () => Date;
}> => {
	return [
		{
			label: "Today",
			value: () => new Date(),
		},
		{
			label: "Tomorrow",
			value: () => {
				const date = new Date();
				date.setDate(date.getDate() + 1);
				return date;
			},
		},
		{
			label: "In 3 days",
			value: () => {
				const date = new Date();
				date.setDate(date.getDate() + 3);
				return date;
			},
		},
		{
			label: "Next week",
			value: () => {
				const date = new Date();
				date.setDate(date.getDate() + 7);
				return date;
			},
		},
		{
			label: "In 2 weeks",
			value: () => {
				const date = new Date();
				date.setDate(date.getDate() + 14);
				return date;
			},
		},
		{
			label: "Next month",
			value: () => {
				const date = new Date();
				date.setMonth(date.getMonth() + 1);
				return date;
			},
		},
	];
};

// Helper function to format confidence as percentage
export const formatConfidence = (confidence: number): string => {
	return `${Math.round(confidence * 100)}%`;
};

// Helper function to get confidence color class
export const getConfidenceColor = (confidence: number): string => {
	if (confidence >= 0.8) return "text-green-600";
	if (confidence >= 0.6) return "text-yellow-600";
	return "text-orange-600";
};

export const sortByDate = <T>(
	items: T[],
	getDate: (item: T) => number | null | undefined,
	direction: "asc" | "desc" = "desc",
): T[] => {
	return [...items].sort((a, b) => {
		const dateA = getDate(a);
		const dateB = getDate(b);

		if (!dateA && !dateB) return 0;
		if (!dateA) return 1;
		if (!dateB) return -1;

		return direction === "asc" ? dateA - dateB : dateB - dateA;
	});
};

export const groupByDate = <T>(
	items: T[],
	getDate: (item: T) => number | null | undefined,
	formatStr = "yyyy-MM-dd",
): Record<string, T[]> => {
	const groups: Record<string, T[]> = {};

	items.forEach((item) => {
		const date = getDate(item);
		if (date) {
			const key = formatDateForDisplay(date, formatStr);
			if (!groups[key]) {
				groups[key] = [];
			}
			groups[key].push(item);
		} else {
			const key = "No date";
			if (!groups[key]) {
				groups[key] = [];
			}
			groups[key].push(item);
		}
	});

	return groups;
};
