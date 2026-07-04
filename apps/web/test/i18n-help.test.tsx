import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider, isMessageKey, translate, type MessageKey } from "../src/i18n";
import { en } from "../src/i18n/en";
import { it as itDict } from "../src/i18n/it";
import { HELP_GROUPS, helpContent } from "../src/i18n/help";
import { InfoDot } from "../src/components/InfoDot";
import { HelpPage } from "../src/features/help/HelpPage";
import { SettingsPage } from "../src/features/settings/SettingsPage";
import { ThemeProvider } from "../src/app/theme";

afterEach(() => {
  localStorage.removeItem("ds-locale");
});

describe("typed i18n core", () => {
  it("interpolates {param} placeholders per locale", () => {
    expect(translate("en", "common.perMonth", { amount: "€900" })).toBe("€900/mo");
    expect(translate("it", "common.perMonth", { amount: "€900" })).toBe("€900/mese");
    expect(translate("en", "common.yearN", { n: 7 })).toBe("year 7");
  });

  it("leaves unknown placeholders untouched instead of crashing", () => {
    expect(translate("en", "common.yearN", {})).toBe("year {n}");
  });

  it("has a non-empty Italian translation for every key", () => {
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(itDict[key], `missing it translation for ${key}`).toBeTruthy();
    }
  });

  it("guards dynamically-built keys", () => {
    expect(isMessageKey("verdict.RENT")).toBe(true);
    expect(isMessageKey("verdict.NOPE")).toBe(false);
  });

  it("has bilingual help content for every topic in every group", () => {
    const topics = Object.values(HELP_GROUPS).flat();
    for (const topic of topics) {
      for (const locale of ["en", "it"] as const) {
        const entry = helpContent[locale][topic];
        expect(entry.title, `${locale}/${topic} title`).toBeTruthy();
        expect(entry.what, `${locale}/${topic} what`).toBeTruthy();
        expect(entry.why, `${locale}/${topic} why`).toBeTruthy();
      }
    }
  });
});

describe("locale switching (Settings → language selector)", () => {
  it("renders Italian copy when the preference is stored, and switches back live", async () => {
    localStorage.setItem("ds-locale", "it");
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <LocaleProvider>
          <MemoryRouter>
            <SettingsPage />
          </MemoryRouter>
        </LocaleProvider>
      </ThemeProvider>,
    );

    expect(screen.getByText("Impostazioni")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Lingua"), "en");
    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(localStorage.getItem("ds-locale")).toBe("en");
  });
});

describe("field help (ⓘ popover + glossary page)", () => {
  it("opens the popover with what/why/direction and a glossary link", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <InfoDot topic="equivalentRent" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Equivalent monthly rent/ }));

    const entry = helpContent.en.equivalentRent;
    expect(await screen.findByText(entry.what)).toBeInTheDocument();
    expect(screen.getByText(entry.why)).toBeInTheDocument();
    expect(screen.getByText(entry.direction!)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Glossary/ })).toBeInTheDocument();
  });

  it("renders the glossary page with every group and topic", async () => {
    render(
      <MemoryRouter>
        <HelpPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Glossary & field guide")).toBeInTheDocument();
    expect(screen.getAllByText("Core concepts").length).toBeGreaterThan(0);
    const topics = Object.values(HELP_GROUPS).flat();
    for (const topic of topics) {
      expect(
        screen.getAllByText(helpContent.en[topic].title).length,
        `topic ${topic} rendered`,
      ).toBeGreaterThan(0);
    }
  });
});
