// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { deleteProfile, listProfiles, loadProfile, saveProfile } from "@/core/persistence/localStorageProfileStore";
import { createDefaultDisplayConfig, createProfile } from "@/core/profile/createProfile";
import type { DelimiterParsingConfig } from "@/core/parsing/types";

function makeProfile(name: string) {
  const parsing: DelimiterParsingConfig = {
    kind: "delimiter",
    delimiter: ",",
    hasHeaderRow: false,
    stripQuotes: false,
    trimBoundaryPartials: false,
    expectedFieldCount: 2,
  };
  return createProfile({ name, parsing, display: createDefaultDisplayConfig(["a", "b"]) });
}

beforeEach(() => {
  localStorage.clear();
});

describe("localStorageProfileStore", () => {
  it("returns an empty list when nothing has been saved", () => {
    expect(listProfiles()).toEqual([]);
  });

  it("saves and lists a Profile", () => {
    const profile = makeProfile("nginx");
    saveProfile(profile);
    expect(listProfiles()).toEqual([profile]);
  });

  it("loads a Profile by id", () => {
    const profile = makeProfile("nginx");
    saveProfile(profile);
    expect(loadProfile(profile.id)).toEqual(profile);
  });

  it("returns undefined when loading an unknown id", () => {
    expect(loadProfile("does-not-exist")).toBeUndefined();
  });

  it("replaces a Profile with the same id instead of duplicating it", () => {
    const profile = makeProfile("nginx");
    saveProfile(profile);

    const renamed = { ...profile, name: "nginx (renamed)" };
    saveProfile(renamed);

    expect(listProfiles()).toEqual([renamed]);
  });

  it("deletes a Profile by id", () => {
    const a = makeProfile("a");
    const b = makeProfile("b");
    saveProfile(a);
    saveProfile(b);

    deleteProfile(a.id);

    expect(listProfiles()).toEqual([b]);
  });

  it("survives corrupt JSON in storage by treating it as empty", () => {
    localStorage.setItem("log-data-parser:profiles", "{not valid json");
    expect(listProfiles()).toEqual([]);
  });

  it("drops individually corrupt entries without discarding the whole store", () => {
    const good = makeProfile("good");
    localStorage.setItem(
      "log-data-parser:profiles",
      JSON.stringify({ schemaVersion: 1, profiles: [good, { not: "a profile" }] }),
    );
    expect(listProfiles()).toEqual([good]);
  });
});
