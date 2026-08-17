import { describe, expect, test } from "bun:test";
import { applyDateKeepingTime } from "./activity-date-utils";

describe("applyDateKeepingTime", () => {
	test("keeps the local calendar day and copies hours/minutes", () => {
		const picked = new Date(2026, 7, 26);
		const existing = new Date(2026, 7, 17, 14, 30);

		const next = applyDateKeepingTime(picked, existing);

		expect(next.getFullYear()).toBe(2026);
		expect(next.getMonth()).toBe(7);
		expect(next.getDate()).toBe(26);
		expect(next.getHours()).toBe(14);
		expect(next.getMinutes()).toBe(30);
	});

	test("does not treat a date-only ISO string as UTC midnight", () => {
		const utcParsed = new Date("2026-08-26");
		const localPicked = new Date(2026, 7, 26);
		const existing = new Date(2026, 7, 17, 9, 0);

		const next = applyDateKeepingTime(localPicked, existing);

		expect(next.getHours()).toBe(9);
		expect(next.getDate()).toBe(26);
		if (utcParsed.getTimezoneOffset() !== 0) {
			expect(utcParsed.getHours()).not.toBe(9);
		}
	});

	test("uses local midnight when no time source is provided", () => {
		const picked = new Date(2026, 7, 26, 18, 45);
		const next = applyDateKeepingTime(picked, undefined);

		expect(next.getDate()).toBe(26);
		expect(next.getHours()).toBe(0);
		expect(next.getMinutes()).toBe(0);
	});
});
