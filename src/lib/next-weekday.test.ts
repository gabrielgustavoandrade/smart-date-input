import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { parseSmartDateString } from "./activity-date-utils";

const days = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
];
const at = (input: string): Date => {
	const r = parseSmartDateString(input);
	if (!r) throw new Error(`no parse: ${input}`);
	return r.date;
};
const ymd = (d: Date) =>
	`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

afterEach(() => setSystemTime());

describe("next <weekday> (reference Monday 2026-10-12)", () => {
	const expected = [19, 13, 14, 15, 16, 17, 18];
	days.forEach((day, i) => {
		test(`next ${day} -> Oct ${expected[i]}`, () => {
			setSystemTime(new Date(2026, 9, 12, 10, 0, 0));
			expect(ymd(at(`next ${day}`))).toBe(`2026-10-${expected[i]}`);
		});
	});

	test("same weekday: next monday on a Monday is +7", () => {
		setSystemTime(new Date(2026, 9, 12, 10, 0, 0));
		expect(ymd(at("next monday"))).toBe("2026-10-19");
	});

	test("next friday at 2pm -> Oct 16 14:00", () => {
		setSystemTime(new Date(2026, 9, 12, 10, 0, 0));
		const d = at("next friday at 2pm");
		expect(ymd(d)).toBe("2026-10-16");
		expect(d.getHours()).toBe(14);
	});

	test("this friday -> Oct 16; this monday on Monday -> today", () => {
		setSystemTime(new Date(2026, 9, 12, 10, 0, 0));
		expect(ymd(at("this friday"))).toBe("2026-10-16");
		expect(ymd(at("this monday"))).toBe("2026-10-12");
	});

	test("from a Saturday, next friday is the following Friday", () => {
		setSystemTime(new Date(2026, 9, 17, 10, 0, 0));
		expect(ymd(at("next friday"))).toBe("2026-10-23");
	});
});
