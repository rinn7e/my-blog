import * as O from "fp-ts/lib/Option.js";
import { type Option } from "fp-ts/lib/Option.js";
import {
  lit,
  str,
  query,
  end,
  Parser,
  zero,
  parse,
  Route,
  format,
  Formatter,
  Match,
} from "fp-ts-routing";
import * as t from "io-ts";

// --- Types ---

export type RoomId = string;
export type ChatId = string;
export type RoomCategory = "active" | "archived" | "deleted";

export type RoomPage = {
  readonly _tag: "RoomPage";
  roomId: Option<RoomId>;
  chatId: Option<ChatId>;
  category: RoomCategory;
};

export type SearchPage = {
  readonly _tag: "SearchPage";
  roomId: Option<RoomId>;
  searchText: string;
};

export type NotFoundPage = {
  readonly _tag: "NotFoundPage";
  path: string[];
};

export type AppPage = RoomPage | SearchPage | NotFoundPage;

export type AppRoute = {
  page: AppPage;
  sidebarOpen: boolean;
};

export const defaultAppRoute: AppRoute = {
  page: {
    _tag: "RoomPage",
    roomId: O.none,
    chatId: O.none,
    category: "active",
  },
  sidebarOpen: false,
};

// --- Matches ---

// &sidebar=<some-value->
const sharedParams = t.exact(
  t.partial({
    sidebar: t.string,
  }),
);

// &category=<some-value->
const roomQuery = t.exact(
  t.partial({
    category: t.string,
  }),
);

// Match any number of string segments in the path.
// Used for the "not found" route to capture the invalid path.
const anyStrings = new Match<{ path: string[] }>(
  new Parser((r) => O.some([{ path: r.parts }, new Route([], r.query)])),
  new Formatter((r, a) => new Route(r.parts.concat(a.path), r.query)),
);

// /
const roomBlankMatch = query(t.intersection([roomQuery, sharedParams])).and(
  end,
);

// /rooms/:roomId
const roomOneMatch = lit("rooms")
  .and(str("roomId"))
  .and(query(t.intersection([roomQuery, sharedParams])))
  .and(end);

// /rooms/:roomId/chats/:chatId
const roomChatMatch = lit("rooms")
  .and(str("roomId"))
  .and(lit("chats"))
  .and(str("chatId"))
  .and(query(t.intersection([roomQuery, sharedParams])))
  .and(end);

// &q=<some-value->&room_id=<some-value->
const searchParams = t.partial({
  q: t.string,
  room_id: t.string,
});

// /search
const searchMatch = lit("search")
  .and(query(t.intersection([searchParams, sharedParams])))
  .and(end);

// otherwise
const notFoundMatch = anyStrings.and(query(sharedParams)).and(end);

// --- Parser ---

const toRoute =
  (page: AppPage) =>
  (p: any): AppRoute => ({
    page,
    sidebarOpen: p.sidebar === "true",
  });

const appRouter: Parser<AppRoute> = zero<AppRoute>()
  .alt(
    roomBlankMatch.parser.map(
      toRoute({
        _tag: "RoomPage",
        roomId: O.none,
        chatId: O.none,
        category: "active",
      }),
    ),
  )
  .alt(
    roomOneMatch.parser.map((p) =>
      toRoute({
        _tag: "RoomPage",
        roomId: O.some(p.roomId),
        chatId: O.none,
        category: (p.category as RoomCategory) || "active",
      })(p),
    ),
  )
  .alt(
    roomChatMatch.parser.map((p) =>
      toRoute({
        _tag: "RoomPage",
        roomId: O.some(p.roomId),
        chatId: O.some(p.chatId),
        category: (p.category as RoomCategory) || "active",
      })(p),
    ),
  )
  .alt(
    searchMatch.parser.map((p) =>
      toRoute({
        _tag: "SearchPage",
        roomId: p.room_id ? O.some(p.room_id) : O.none,
        searchText: p.q || "",
      })(p),
    ),
  )
  .alt(
    notFoundMatch.parser.map((p) =>
      toRoute({ _tag: "NotFoundPage", path: p.path })(p),
    ),
  );

// --- Implementation ---

export const parseAppRoute = (href: string): AppRoute => {
  return parse(appRouter, Route.parse(href), defaultAppRoute);
};

export const toUrlString = (route: AppRoute): string => {
  const params: any = { sidebar: route.sidebarOpen ? "true" : undefined };

  switch (route.page._tag) {
    case "RoomPage": {
      const roomParams = { ...params, category: route.page.category };
      const roomId = route.page.roomId;
      if (O.isSome(roomId)) {
        const chatId = route.page.chatId;
        if (O.isSome(chatId)) {
          return format(roomChatMatch.formatter, {
            ...roomParams,
            roomId: roomId.value,
            chatId: chatId.value,
          });
        }
        return format(roomOneMatch.formatter, {
          ...roomParams,
          roomId: roomId.value,
        });
      }
      return format(roomBlankMatch.formatter, roomParams);
    }
    case "SearchPage": {
      return format(searchMatch.formatter, {
        ...params,
        q: route.page.searchText,
        room_id: O.toUndefined(route.page.roomId),
      });
    }
    case "NotFoundPage": {
      return format(notFoundMatch.formatter, {
        ...params,
        path: route.page.path,
      });
    }
    default:
      return "/";
  }
};
