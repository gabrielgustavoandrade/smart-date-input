import { Calendar, Check, Clock, Sparkles } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import {
	formatConfidence,
	formatDateForInput,
	generateSmartSuggestions,
	getConfidenceColor,
	parseSmartDateString,
	type SmartSuggestion,
} from "../lib/activity-date-utils";

// Base UI Components - you'll need to replace these with your own or install dependencies
const Button = React.forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: "outline" | "default";
		size?: "sm" | "default";
	}
>(({ className, variant = "default", size = "default", ...props }, ref) => (
	<button
		className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background ${
			variant === "outline"
				? "border border-input hover:bg-accent hover:text-accent-foreground"
				: "bg-primary text-primary-foreground hover:bg-primary/90"
		} ${
			size === "sm" ? "h-9 px-3 rounded-md" : "h-10 py-2 px-4"
		} ${className || ""}`}
		ref={ref}
		{...props}
	/>
));

const Input = React.forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
	<input
		className={`flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`}
		ref={ref}
		{...props}
	/>
));

// Simple Calendar component - you'll want to replace this with a proper one like react-day-picker
const CalendarComponent = ({
	selected,
	onSelect,
	disabled,
}: {
	mode?: "single";
	selected?: Date;
	onSelect: (date: Date | undefined) => void;
	disabled?: boolean;
}) => (
	<div className="p-3">
		<input
			type="date"
			value={selected ? selected.toISOString().split("T")[0] : ""}
			onChange={(e) =>
				onSelect(e.target.value ? new Date(e.target.value) : undefined)
			}
			disabled={disabled}
			className="w-full p-2 border rounded"
		/>
	</div>
);

// Simple Popover components - replace with your preferred popover library
const Popover = ({
	children,
	open,
	onOpenChange,
}: {
	children: React.ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => (
	<div className="relative">
		{React.Children.map(children, (child, index) => {
			if (React.isValidElement(child)) {
				if (index === 0) {
					return React.cloneElement(
						child as React.ReactElement<{ onClick?: () => void }>,
						{ onClick: () => onOpenChange(!open) }
					);
				}
				if (index === 1 && open) {
					return child;
				}
			}
			return child;
		})}
	</div>
);

const PopoverTrigger = ({
	children,
}: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>;

const PopoverContent = ({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
	align?: string;
}) => (
	<div
		className={`absolute z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg ${className || ""}`}
	>
		{children}
	</div>
);

interface SmartDateInputProps {
	value?: number | null;
	onChange: (value: number | null) => void;
	showTime?: boolean;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	ref?: React.Ref<HTMLInputElement>;
}

export function SmartDateInput({
	value,
	onChange,
	showTime = false,
	placeholder,
	className = "",
	disabled = false,
	ref: externalRef,
}: SmartDateInputProps) {
	const [inputValue, setInputValue] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
	const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
	const [currentParseResult, setCurrentParseResult] =
		useState<ReturnType<typeof parseSmartDateString>>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (externalRef) {
			if (typeof externalRef === "function") {
				externalRef(inputRef.current);
			} else if (externalRef && "current" in externalRef) {
				(
					externalRef as React.MutableRefObject<HTMLInputElement | null>
				).current = inputRef.current;
			}
		}
	}, [externalRef]);

	useEffect(() => {
		if (value) {
			setInputValue(formatDateForInput(new Date(value), showTime));
		} else {
			setInputValue("");
		}
	}, [value, showTime]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		setInputValue(newValue);

		// Generate smart suggestions based on input
		const newSuggestions = generateSmartSuggestions(newValue, showTime);
		setSuggestions(newSuggestions);
		setShowSuggestions(newSuggestions.length > 0);
		setSelectedSuggestionIndex(-1);

		// Try to parse the current input with confidence scoring
		const parseResult = parseSmartDateString(newValue);
		setCurrentParseResult(parseResult);

		// Only clear the date when input is empty
		// Don't auto-apply - wait for explicit selection
		if (newValue === "") {
			onChange(null);
		}
	};

	const handleSuggestionSelect = (suggestionValue: string) => {
		setInputValue(suggestionValue);
		setShowSuggestions(false);
		setSelectedSuggestionIndex(-1);

		const parseResult = parseSmartDateString(suggestionValue);
		if (parseResult) {
			onChange(parseResult.date.getTime());
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown" && showSuggestions && suggestions.length > 0) {
			e.preventDefault();
			setSelectedSuggestionIndex((prev) =>
				prev < suggestions.length - 1 ? prev + 1 : 0,
			);
		} else if (
			e.key === "ArrowUp" &&
			showSuggestions &&
			suggestions.length > 0
		) {
			e.preventDefault();
			setSelectedSuggestionIndex((prev) =>
				prev > 0 ? prev - 1 : suggestions.length - 1,
			);
		} else if (e.key === "Enter") {
			if (showSuggestions && selectedSuggestionIndex >= 0) {
				// User selected a suggestion
				e.preventDefault();
				handleSuggestionSelect(suggestions[selectedSuggestionIndex].value);
			} else if (
				!showSuggestions &&
				currentParseResult &&
				currentParseResult.confidence >= 0.5
			) {
				// User pressed Enter with a valid parse (no suggestions shown)
				e.preventDefault();
				onChange(currentParseResult.date.getTime());
				setInputValue(formatDateForInput(currentParseResult.date, showTime));
			}
		} else if (e.key === "Tab" && showSuggestions && suggestions.length > 0) {
			// Tab to accept the first/selected suggestion
			if (selectedSuggestionIndex >= 0) {
				e.preventDefault();
				handleSuggestionSelect(suggestions[selectedSuggestionIndex].value);
			} else if (suggestions.length > 0) {
				e.preventDefault();
				handleSuggestionSelect(suggestions[0].value);
			}
		} else if (e.key === "Escape") {
			setShowSuggestions(false);
			setSelectedSuggestionIndex(-1);
		}
	};

	const handleFocus = () => {
		const newSuggestions = generateSmartSuggestions(inputValue, showTime);
		setSuggestions(newSuggestions);
		setShowSuggestions(newSuggestions.length > 0);
	};

	const handleBlur = (_e: React.FocusEvent) => {
		// Delay hiding suggestions to allow for clicks
		setTimeout(() => {
			setShowSuggestions(false);
			setSelectedSuggestionIndex(-1);
		}, 150);
	};

	const handleDateSelect = (date: Date | undefined) => {
		if (date) {
			// If we have a time component from the current parse, preserve it
			if (showTime && currentParseResult?.parsedComponents.time) {
				const existingTime = currentParseResult.date;
				date.setHours(existingTime.getHours());
				date.setMinutes(existingTime.getMinutes());
			}
			onChange(date.getTime());
			setIsOpen(false);
		}
	};

	const handleTimeChange = (timeString: string) => {
		const [hours, minutes] = timeString.split(":").map(Number);
		const date = value ? new Date(value) : new Date();
		date.setHours(hours || 0);
		date.setMinutes(minutes || 0);
		onChange(date.getTime());
	};

	const selectedDate = value ? new Date(value) : undefined;

	return (
		<div className="relative">
			<div className="flex items-center gap-2">
				<div className="relative flex-1">
					<div className="relative">
						<Input
							ref={inputRef}
							value={inputValue}
							onChange={handleInputChange}
							onKeyDown={handleKeyDown}
							onFocus={handleFocus}
							onBlur={handleBlur}
							placeholder={
								placeholder ||
								(showTime ? "Enter date and time..." : "Enter date...")
							}
							className={`${className} ${currentParseResult && currentParseResult.confidence > 0.5 ? "border-green-300" : ""}`}
							disabled={disabled}
						/>

						{/* Parse confidence indicator */}
						{currentParseResult && currentParseResult.confidence > 0.5 && (
							<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
								<Sparkles
									className={`h-3 w-3 ${getConfidenceColor(currentParseResult.confidence)}`}
								/>
								<span
									className={`text-xs ${getConfidenceColor(currentParseResult.confidence)}`}
								>
									{formatConfidence(currentParseResult.confidence)}
								</span>
							</div>
						)}
					</div>

					{/* Smart suggestions dropdown */}
					{showSuggestions && suggestions.length > 0 && (
						<div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-auto">
							{suggestions.map((suggestion, index) => (
								<div
									key={`${suggestion.value}-${index}`}
									className={`px-3 py-2 cursor-pointer text-sm hover:bg-gray-50 border-l-2 ${
										index === selectedSuggestionIndex
											? "bg-blue-50 border-l-blue-500"
											: suggestion.confidence >= 0.8
												? "border-l-green-400"
												: suggestion.confidence >= 0.6
													? "border-l-yellow-400"
													: "border-l-orange-400"
									}`}
									onMouseDown={(e) => {
										e.preventDefault(); // Prevent input blur
										handleSuggestionSelect(suggestion.value);
									}}
									onMouseEnter={() => setSelectedSuggestionIndex(index)}
								>
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2">
												<span className="font-medium">
													{suggestion.category === "natural"
														? suggestion.label.split(" → ")[0]
														: suggestion.label}
												</span>
												{suggestion.category === "time" && (
													<Clock className="h-3 w-3 text-blue-600" />
												)}
												{suggestion.category === "date" && (
													<Calendar className="h-3 w-3 text-purple-600" />
												)}
											</div>
											<div className="text-xs text-gray-500 mt-0.5">
												{suggestion.preview}
											</div>
										</div>
										<div className="flex items-center gap-2 text-xs">
											<span
												className={getConfidenceColor(suggestion.confidence)}
											>
												{formatConfidence(suggestion.confidence)}
											</span>
											{index === selectedSuggestionIndex && (
												<Check className="h-3 w-3 text-blue-600" />
											)}
										</div>
									</div>
								</div>
							))}

							{/* Help text at bottom */}
							<div className="border-t bg-gray-50 px-3 py-2 text-xs text-gray-600">
								<div className="flex items-center gap-1">
									<Sparkles className="h-3 w-3" />
									Try: "tomorrow 7am", "Oct 15 at 4", "next Friday", "in 3 days"
								</div>
							</div>
						</div>
					)}
				</div>

				<Popover open={isOpen} onOpenChange={setIsOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="h-9 w-9 p-0"
							disabled={disabled}
						>
							<Calendar className="h-4 w-4" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<CalendarComponent
							mode="single"
							selected={selectedDate}
							onSelect={handleDateSelect}
							disabled={disabled}
						/>
						{showTime && (
							<div className="border-t p-3">
								<div className="flex items-center gap-2">
									<Clock className="h-4 w-4" />
									<Input
										type="time"
										value={
											selectedDate
												? `${selectedDate.getHours().toString().padStart(2, "0")}:${selectedDate.getMinutes().toString().padStart(2, "0")}`
												: ""
										}
										onChange={(e) => handleTimeChange(e.target.value)}
										className="w-auto"
									/>
								</div>
							</div>
						)}
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
}
