export { SmartDateInput } from "./components/SmartDateInput";
export type {
	SmartSuggestion,
	DateParseResult,
} from "./lib/activity-date-utils";
export {
	parseSmartDateString,
	parseDateString,
	formatDateForInput,
	formatDateForDisplay,
	formatRelativeTime,
	generateSmartSuggestions,
	isOverdue,
	getDueDateStatus,
	getDatePresets,
	formatConfidence,
	getConfidenceColor,
	sortByDate,
	groupByDate,
} from "./lib/activity-date-utils";
