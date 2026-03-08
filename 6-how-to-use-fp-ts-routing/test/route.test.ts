import { describe, it, expect } from "vitest";
import {
  parseAppRoute,
  toUrlString,
  type AppRoute,
  type RoomPage,
  type SearchPage,
  type NotFoundPage,
} from "../src/route.js";
import * as O from "fp-ts/lib/Option.js";

describe("Route parsing and generation", () => {
  it("should parse root path correctly", () => {
    const route = parseAppRoute("/");
    expect(route.page._tag).toBe("RoomPage");
    const page = route.page as RoomPage;
    expect(O.isNone(page.roomId)).toBe(true);
  });

  it("should parse room detail correctly", () => {
    const route = parseAppRoute("/rooms/room-123");
    expect(route.page._tag).toBe("RoomPage");
    const page = route.page as RoomPage;
    expect(O.isSome(page.roomId)).toBe(true);
    if (O.isSome(page.roomId)) {
      expect(page.roomId.value).toBe("room-123");
    }
  });

  it("should parse room chat correctly", () => {
    const route = parseAppRoute("/rooms/room-123/chats/chat-456?sidebar=true");
    expect(route.page._tag).toBe("RoomPage");
    expect(route.sidebarOpen).toBe(true);
    const page = route.page as RoomPage;
    expect(O.isSome(page.chatId)).toBe(true);
    if (O.isSome(page.chatId)) {
      expect(page.chatId.value).toBe("chat-456");
    }
  });

  it("should parse SearchPage correctly", () => {
    const route = parseAppRoute("/search?q=hello&room_id=room-123");
    expect(route.page._tag).toBe("SearchPage");
    const searchPage = route.page as SearchPage;
    expect(searchPage.searchText).toBe("hello");
    expect(O.isSome(searchPage.roomId)).toBe(true);
    if (O.isSome(searchPage.roomId)) {
      expect(searchPage.roomId.value).toBe("room-123");
    }
  });

  it("should generate URL correctly using toUrlString", () => {
    const searchRoute: AppRoute = {
      page: {
        _tag: "SearchPage",
        roomId: O.some("room-123"),
        searchText: "fp-ts",
      },
      sidebarOpen: false,
    };
    const url = toUrlString(searchRoute);
    expect(url).toContain("/search");
    expect(url).toContain("q=fp-ts");
    expect(url).toContain("room_id=room-123");
  });

  it("should handle unknown paths with NotFoundPage", () => {
    const route = parseAppRoute("/unknown/path/here");
    expect(route.page._tag).toBe("NotFoundPage");
    const page = route.page as NotFoundPage;
    expect(page.path).toEqual(["unknown", "path", "here"]);

    const url = toUrlString(route);
    expect(url).toBe("/unknown/path/here");
  });
});
