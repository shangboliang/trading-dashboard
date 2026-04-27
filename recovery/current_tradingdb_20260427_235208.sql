--
-- PostgreSQL database dump
--

\restrict Lv5wbfXakKN8i7cYBeJfbQswqlojhrHxT6MDQiqIgD1xpbWDo99LRHXfiedbTsH

-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: Exchange; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Exchange" AS ENUM (
    'BINANCE',
    'OKX',
    'BYBIT',
    'HUOBI',
    'GATEIO',
    'KUCOIN'
);


ALTER TYPE public."Exchange" OWNER TO postgres;

--
-- Name: LegSide; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LegSide" AS ENUM (
    'LONG',
    'SHORT'
);


ALTER TYPE public."LegSide" OWNER TO postgres;

--
-- Name: LegStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LegStatus" AS ENUM (
    'OPEN',
    'CLOSED',
    'PARTIALLY_CLOSED',
    'LIQUIDATED',
    'CANCELLED'
);


ALTER TYPE public."LegStatus" OWNER TO postgres;

--
-- Name: OrderType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderType" AS ENUM (
    'MARKET',
    'LIMIT',
    'STOP_LOSS',
    'STOP_LOSS_LIMIT',
    'TAKE_PROFIT',
    'TAKE_PROFIT_LIMIT'
);


ALTER TYPE public."OrderType" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'USER',
    'ADMIN',
    'PREMIUM'
);


ALTER TYPE public."Role" OWNER TO postgres;

--
-- Name: SyncStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SyncStatus" AS ENUM (
    'PENDING',
    'SYNCING',
    'COMPLETED',
    'FAILED'
);


ALTER TYPE public."SyncStatus" OWNER TO postgres;

--
-- Name: TradeSide; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TradeSide" AS ENUM (
    'BUY',
    'SELL'
);


ALTER TYPE public."TradeSide" OWNER TO postgres;

--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'DELETED'
);


ALTER TYPE public."UserStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ApiKey; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ApiKey" (
    id integer NOT NULL,
    uuid text NOT NULL,
    "userId" integer NOT NULL,
    name text NOT NULL,
    exchange public."Exchange" NOT NULL,
    "apiKey" text NOT NULL,
    "apiSecret" text NOT NULL,
    passphrase text,
    permissions jsonb,
    "ipWhitelist" text[],
    "isVerified" boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "lastSyncAt" timestamp(3) without time zone,
    "syncStatus" public."SyncStatus" DEFAULT 'PENDING'::public."SyncStatus" NOT NULL,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "asynSyncCount" integer DEFAULT 0 NOT NULL,
    "lastAsynSyncAt" timestamp(3) without time zone
);


ALTER TABLE public."ApiKey" OWNER TO postgres;

--
-- Name: ApiKey_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ApiKey_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."ApiKey_id_seq" OWNER TO postgres;

--
-- Name: ApiKey_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ApiKey_id_seq" OWNED BY public."ApiKey".id;


--
-- Name: AsyncSyncTask; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AsyncSyncTask" (
    id integer NOT NULL,
    "apiKeyId" integer NOT NULL,
    "downloadId" text NOT NULL,
    status text NOT NULL,
    "downloadUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AsyncSyncTask" OWNER TO postgres;

--
-- Name: AsyncSyncTask_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."AsyncSyncTask_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."AsyncSyncTask_id_seq" OWNER TO postgres;

--
-- Name: AsyncSyncTask_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."AsyncSyncTask_id_seq" OWNED BY public."AsyncSyncTask".id;


--
-- Name: FundingFee; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FundingFee" (
    id integer NOT NULL,
    "apiKeyId" integer NOT NULL,
    "legId" integer,
    symbol text NOT NULL,
    amount double precision NOT NULL,
    "amountUsd" double precision NOT NULL,
    "timestamp" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."FundingFee" OWNER TO postgres;

--
-- Name: FundingFee_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."FundingFee_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."FundingFee_id_seq" OWNER TO postgres;

--
-- Name: FundingFee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."FundingFee_id_seq" OWNED BY public."FundingFee".id;


--
-- Name: Leg; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Leg" (
    id integer NOT NULL,
    uuid text NOT NULL,
    "userId" integer NOT NULL,
    symbol text NOT NULL,
    "baseAsset" text DEFAULT ''::text NOT NULL,
    "quoteAsset" text DEFAULT ''::text NOT NULL,
    side public."LegSide" NOT NULL,
    "openDate" timestamp(3) without time zone NOT NULL,
    "openPrice" double precision NOT NULL,
    "closeDate" timestamp(3) without time zone,
    "closePrice" double precision,
    status public."LegStatus" DEFAULT 'OPEN'::public."LegStatus" NOT NULL,
    "openAmount" double precision NOT NULL,
    "closeAmount" double precision,
    "currentAmount" double precision NOT NULL,
    "averageEntry" double precision NOT NULL,
    "averageExit" double precision,
    "realisedPnL" double precision DEFAULT 0 NOT NULL,
    "realisedPnLusd" double precision DEFAULT 0 NOT NULL,
    "unrealisedPnL" double precision,
    commission double precision DEFAULT 0 NOT NULL,
    "commissionUsd" double precision DEFAULT 0 NOT NULL,
    "netPnL" double precision DEFAULT 0 NOT NULL,
    "fundingFeeUsd" double precision DEFAULT 0 NOT NULL,
    "sizeUsd" double precision NOT NULL,
    "peakSizeUsd" double precision,
    duration integer,
    mae double precision,
    mfe double precision,
    "entryQuality" double precision,
    "exitQuality" double precision,
    notes text,
    strategy text,
    setup text,
    mistakes text,
    "snapshotData" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Leg" OWNER TO postgres;

--
-- Name: Leg_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Leg_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Leg_id_seq" OWNER TO postgres;

--
-- Name: Leg_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Leg_id_seq" OWNED BY public."Leg".id;


--
-- Name: Session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Session" (
    id integer NOT NULL,
    "tokenHash" text NOT NULL,
    "userId" integer NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Session" OWNER TO postgres;

--
-- Name: Session_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Session_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Session_id_seq" OWNER TO postgres;

--
-- Name: Session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Session_id_seq" OWNED BY public."Session".id;


--
-- Name: SyncLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SyncLog" (
    id integer NOT NULL,
    uuid text NOT NULL,
    "apiKeyId" integer NOT NULL,
    status public."SyncStatus" NOT NULL,
    "startTime" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endTime" timestamp(3) without time zone,
    "tradesFound" integer DEFAULT 0 NOT NULL,
    "tradesImported" integer DEFAULT 0 NOT NULL,
    "legsCreated" integer DEFAULT 0 NOT NULL,
    "legsUpdated" integer DEFAULT 0 NOT NULL,
    "errorMessage" text,
    "errorStack" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."SyncLog" OWNER TO postgres;

--
-- Name: SyncLog_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SyncLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."SyncLog_id_seq" OWNER TO postgres;

--
-- Name: SyncLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SyncLog_id_seq" OWNED BY public."SyncLog".id;


--
-- Name: SystemConfig; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SystemConfig" (
    id integer NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SystemConfig" OWNER TO postgres;

--
-- Name: SystemConfig_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SystemConfig_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."SystemConfig_id_seq" OWNER TO postgres;

--
-- Name: SystemConfig_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SystemConfig_id_seq" OWNED BY public."SystemConfig".id;


--
-- Name: Tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Tag" (
    id integer NOT NULL,
    uuid text NOT NULL,
    "userId" integer,
    name text NOT NULL,
    slug text NOT NULL,
    color text DEFAULT '#6366f1'::text NOT NULL,
    icon text,
    description text,
    "usageCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Tag" OWNER TO postgres;

--
-- Name: Tag_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Tag_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Tag_id_seq" OWNER TO postgres;

--
-- Name: Tag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Tag_id_seq" OWNED BY public."Tag".id;


--
-- Name: Trade; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Trade" (
    id text NOT NULL,
    uuid text NOT NULL,
    "apiKeyId" integer NOT NULL,
    "legId" integer,
    symbol text NOT NULL,
    "baseAsset" text DEFAULT ''::text NOT NULL,
    "quoteAsset" text DEFAULT ''::text NOT NULL,
    side public."TradeSide" NOT NULL,
    "positionSide" text DEFAULT 'BOTH'::text NOT NULL,
    type public."OrderType",
    price double precision NOT NULL,
    amount double precision NOT NULL,
    "quoteAmount" double precision NOT NULL,
    fee double precision NOT NULL,
    "feeAsset" text NOT NULL,
    "feeUsd" double precision DEFAULT 0 NOT NULL,
    "timestamp" timestamp(3) without time zone NOT NULL,
    "tradedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rawJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Trade" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    uuid text NOT NULL,
    email text NOT NULL,
    "passwordHash" text,
    name text,
    "avatarUrl" text,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastLoginAt" timestamp(3) without time zone
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: UserSettings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."UserSettings" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "defaultTimeframe" text DEFAULT '30d'::text NOT NULL,
    currency text DEFAULT 'USDT'::text NOT NULL,
    theme text DEFAULT 'dark'::text NOT NULL,
    "enableEmailNotify" boolean DEFAULT false NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."UserSettings" OWNER TO postgres;

--
-- Name: UserSettings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."UserSettings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."UserSettings_id_seq" OWNER TO postgres;

--
-- Name: UserSettings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."UserSettings_id_seq" OWNED BY public."UserSettings".id;


--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _LegTags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."_LegTags" (
    "A" integer NOT NULL,
    "B" integer NOT NULL
);


ALTER TABLE public."_LegTags" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: ApiKey id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ApiKey" ALTER COLUMN id SET DEFAULT nextval('public."ApiKey_id_seq"'::regclass);


--
-- Name: AsyncSyncTask id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AsyncSyncTask" ALTER COLUMN id SET DEFAULT nextval('public."AsyncSyncTask_id_seq"'::regclass);


--
-- Name: FundingFee id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FundingFee" ALTER COLUMN id SET DEFAULT nextval('public."FundingFee_id_seq"'::regclass);


--
-- Name: Leg id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Leg" ALTER COLUMN id SET DEFAULT nextval('public."Leg_id_seq"'::regclass);


--
-- Name: Session id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Session" ALTER COLUMN id SET DEFAULT nextval('public."Session_id_seq"'::regclass);


--
-- Name: SyncLog id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SyncLog" ALTER COLUMN id SET DEFAULT nextval('public."SyncLog_id_seq"'::regclass);


--
-- Name: SystemConfig id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SystemConfig" ALTER COLUMN id SET DEFAULT nextval('public."SystemConfig_id_seq"'::regclass);


--
-- Name: Tag id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tag" ALTER COLUMN id SET DEFAULT nextval('public."Tag_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: UserSettings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserSettings" ALTER COLUMN id SET DEFAULT nextval('public."UserSettings_id_seq"'::regclass);


--
-- Data for Name: ApiKey; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ApiKey" (id, uuid, "userId", name, exchange, "apiKey", "apiSecret", passphrase, permissions, "ipWhitelist", "isVerified", "verifiedAt", "lastSyncAt", "syncStatus", "errorMessage", "createdAt", "updatedAt", "asynSyncCount", "lastAsynSyncAt") FROM stdin;
\.


--
-- Data for Name: AsyncSyncTask; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AsyncSyncTask" (id, "apiKeyId", "downloadId", status, "downloadUrl", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: FundingFee; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FundingFee" (id, "apiKeyId", "legId", symbol, amount, "amountUsd", "timestamp", "createdAt") FROM stdin;
\.


--
-- Data for Name: Leg; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Leg" (id, uuid, "userId", symbol, "baseAsset", "quoteAsset", side, "openDate", "openPrice", "closeDate", "closePrice", status, "openAmount", "closeAmount", "currentAmount", "averageEntry", "averageExit", "realisedPnL", "realisedPnLusd", "unrealisedPnL", commission, "commissionUsd", "netPnL", "fundingFeeUsd", "sizeUsd", "peakSizeUsd", duration, mae, mfe, "entryQuality", "exitQuality", notes, strategy, setup, mistakes, "snapshotData", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Session" (id, "tokenHash", "userId", "expiresAt", "createdAt") FROM stdin;
2	470e1b12674f44460268e6cbd847fc091adb0e68cb8d493053ee235d9f8c16c5	1	2026-05-27 23:23:00.574	2026-04-27 23:23:00.579
\.


--
-- Data for Name: SyncLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SyncLog" (id, uuid, "apiKeyId", status, "startTime", "endTime", "tradesFound", "tradesImported", "legsCreated", "legsUpdated", "errorMessage", "errorStack", metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: SystemConfig; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SystemConfig" (id, key, value, description, "updatedAt") FROM stdin;
\.


--
-- Data for Name: Tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Tag" (id, uuid, "userId", name, slug, color, icon, description, "usageCount", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Trade; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Trade" (id, uuid, "apiKeyId", "legId", symbol, "baseAsset", "quoteAsset", side, "positionSide", type, price, amount, "quoteAmount", fee, "feeAsset", "feeUsd", "timestamp", "tradedAt", "rawJson", "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, uuid, email, "passwordHash", name, "avatarUrl", timezone, status, role, "createdAt", "updatedAt", "lastLoginAt") FROM stdin;
1	cmngvyhuc000111603a41nhq3	sblsbl2022@hotmail.com	scrypt:f500fdd71f4a35db2bdea7b230d35f16:199eb6bf93baade2f294b2f3f5c7c50ce32c468e05351abb67a1206d615e64759f9a5523a3aa11d7373e87836cf5ab78b600d54ef8cb1125d526255b2b074e2f	beck	\N	Asia/Shanghai	ACTIVE	ADMIN	2026-04-27 15:17:52.737	2026-04-27 15:23:00.567	2026-04-27 15:23:00.566
\.


--
-- Data for Name: UserSettings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."UserSettings" (id, "userId", "defaultTimeframe", currency, theme, "enableEmailNotify", "updatedAt") FROM stdin;
2	1	30d	USDT	dark	f	2026-04-27 15:17:52.737
\.


--
-- Data for Name: _LegTags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."_LegTags" ("A", "B") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
0a6e6f5d-4218-4bb4-9a8e-ec82dfbca84d	6cc3dfbb02821148d7852a80b48d896baa513afb9c0e8e0a98e9c408a556353e	2026-04-02 21:30:14.87703+08	20260402133014_add_funding_fee_and_position_side	\N	\N	2026-04-02 21:30:14.713611+08	1
\.


--
-- Name: ApiKey_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ApiKey_id_seq"', 2, true);


--
-- Name: AsyncSyncTask_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."AsyncSyncTask_id_seq"', 1, true);


--
-- Name: FundingFee_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."FundingFee_id_seq"', 791, true);


--
-- Name: Leg_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Leg_id_seq"', 1244, true);


--
-- Name: Session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Session_id_seq"', 2, true);


--
-- Name: SyncLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."SyncLog_id_seq"', 9, true);


--
-- Name: SystemConfig_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."SystemConfig_id_seq"', 1, false);


--
-- Name: Tag_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Tag_id_seq"', 1, false);


--
-- Name: UserSettings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."UserSettings_id_seq"', 2, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 2, true);


--
-- Name: ApiKey ApiKey_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ApiKey"
    ADD CONSTRAINT "ApiKey_pkey" PRIMARY KEY (id);


--
-- Name: AsyncSyncTask AsyncSyncTask_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AsyncSyncTask"
    ADD CONSTRAINT "AsyncSyncTask_pkey" PRIMARY KEY (id);


--
-- Name: FundingFee FundingFee_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FundingFee"
    ADD CONSTRAINT "FundingFee_pkey" PRIMARY KEY (id);


--
-- Name: Leg Leg_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Leg"
    ADD CONSTRAINT "Leg_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: SyncLog SyncLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SyncLog"
    ADD CONSTRAINT "SyncLog_pkey" PRIMARY KEY (id);


--
-- Name: SystemConfig SystemConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SystemConfig"
    ADD CONSTRAINT "SystemConfig_pkey" PRIMARY KEY (id);


--
-- Name: Tag Tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tag"
    ADD CONSTRAINT "Tag_pkey" PRIMARY KEY (id);


--
-- Name: Trade Trade_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Trade"
    ADD CONSTRAINT "Trade_pkey" PRIMARY KEY (id);


--
-- Name: UserSettings UserSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserSettings"
    ADD CONSTRAINT "UserSettings_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: ApiKey_exchange_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ApiKey_exchange_idx" ON public."ApiKey" USING btree (exchange);


--
-- Name: ApiKey_isVerified_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ApiKey_isVerified_idx" ON public."ApiKey" USING btree ("isVerified");


--
-- Name: ApiKey_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ApiKey_userId_idx" ON public."ApiKey" USING btree ("userId");


--
-- Name: ApiKey_uuid_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ApiKey_uuid_key" ON public."ApiKey" USING btree (uuid);


--
-- Name: AsyncSyncTask_apiKeyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AsyncSyncTask_apiKeyId_idx" ON public."AsyncSyncTask" USING btree ("apiKeyId");


--
-- Name: AsyncSyncTask_downloadId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AsyncSyncTask_downloadId_idx" ON public."AsyncSyncTask" USING btree ("downloadId");


--
-- Name: AsyncSyncTask_downloadId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AsyncSyncTask_downloadId_key" ON public."AsyncSyncTask" USING btree ("downloadId");


--
-- Name: FundingFee_apiKeyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "FundingFee_apiKeyId_idx" ON public."FundingFee" USING btree ("apiKeyId");


--
-- Name: FundingFee_apiKeyId_symbol_timestamp_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "FundingFee_apiKeyId_symbol_timestamp_key" ON public."FundingFee" USING btree ("apiKeyId", symbol, "timestamp");


--
-- Name: FundingFee_legId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "FundingFee_legId_idx" ON public."FundingFee" USING btree ("legId");


--
-- Name: FundingFee_symbol_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "FundingFee_symbol_idx" ON public."FundingFee" USING btree (symbol);


--
-- Name: FundingFee_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "FundingFee_timestamp_idx" ON public."FundingFee" USING btree ("timestamp");


--
-- Name: Leg_closeDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Leg_closeDate_idx" ON public."Leg" USING btree ("closeDate");


--
-- Name: Leg_netPnL_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Leg_netPnL_idx" ON public."Leg" USING btree ("netPnL");


--
-- Name: Leg_openDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Leg_openDate_idx" ON public."Leg" USING btree ("openDate");


--
-- Name: Leg_side_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Leg_side_idx" ON public."Leg" USING btree (side);


--
-- Name: Leg_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Leg_status_idx" ON public."Leg" USING btree (status);


--
-- Name: Leg_symbol_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Leg_symbol_idx" ON public."Leg" USING btree (symbol);


--
-- Name: Leg_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Leg_userId_idx" ON public."Leg" USING btree ("userId");


--
-- Name: Leg_uuid_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Leg_uuid_key" ON public."Leg" USING btree (uuid);


--
-- Name: Session_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Session_expiresAt_idx" ON public."Session" USING btree ("expiresAt");


--
-- Name: Session_tokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Session_tokenHash_key" ON public."Session" USING btree ("tokenHash");


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: SyncLog_apiKeyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SyncLog_apiKeyId_idx" ON public."SyncLog" USING btree ("apiKeyId");


--
-- Name: SyncLog_startTime_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SyncLog_startTime_idx" ON public."SyncLog" USING btree ("startTime");


--
-- Name: SyncLog_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SyncLog_status_idx" ON public."SyncLog" USING btree (status);


--
-- Name: SyncLog_uuid_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SyncLog_uuid_key" ON public."SyncLog" USING btree (uuid);


--
-- Name: SystemConfig_key_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SystemConfig_key_idx" ON public."SystemConfig" USING btree (key);


--
-- Name: SystemConfig_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SystemConfig_key_key" ON public."SystemConfig" USING btree (key);


--
-- Name: Tag_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tag_name_idx" ON public."Tag" USING btree (name);


--
-- Name: Tag_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tag_slug_idx" ON public."Tag" USING btree (slug);


--
-- Name: Tag_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Tag_slug_key" ON public."Tag" USING btree (slug);


--
-- Name: Tag_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tag_userId_idx" ON public."Tag" USING btree ("userId");


--
-- Name: Tag_uuid_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Tag_uuid_key" ON public."Tag" USING btree (uuid);


--
-- Name: Trade_apiKeyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Trade_apiKeyId_idx" ON public."Trade" USING btree ("apiKeyId");


--
-- Name: Trade_legId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Trade_legId_idx" ON public."Trade" USING btree ("legId");


--
-- Name: Trade_side_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Trade_side_idx" ON public."Trade" USING btree (side);


--
-- Name: Trade_symbol_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Trade_symbol_idx" ON public."Trade" USING btree (symbol);


--
-- Name: Trade_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Trade_timestamp_idx" ON public."Trade" USING btree ("timestamp");


--
-- Name: Trade_uuid_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Trade_uuid_key" ON public."Trade" USING btree (uuid);


--
-- Name: UserSettings_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "UserSettings_userId_idx" ON public."UserSettings" USING btree ("userId");


--
-- Name: UserSettings_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "UserSettings_userId_key" ON public."UserSettings" USING btree ("userId");


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_status_idx" ON public."User" USING btree (status);


--
-- Name: User_uuid_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_uuid_key" ON public."User" USING btree (uuid);


--
-- Name: _LegTags_AB_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "_LegTags_AB_unique" ON public."_LegTags" USING btree ("A", "B");


--
-- Name: _LegTags_B_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "_LegTags_B_index" ON public."_LegTags" USING btree ("B");


--
-- Name: ApiKey ApiKey_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ApiKey"
    ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AsyncSyncTask AsyncSyncTask_apiKeyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AsyncSyncTask"
    ADD CONSTRAINT "AsyncSyncTask_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES public."ApiKey"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FundingFee FundingFee_apiKeyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FundingFee"
    ADD CONSTRAINT "FundingFee_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES public."ApiKey"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FundingFee FundingFee_legId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FundingFee"
    ADD CONSTRAINT "FundingFee_legId_fkey" FOREIGN KEY ("legId") REFERENCES public."Leg"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Leg Leg_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Leg"
    ADD CONSTRAINT "Leg_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SyncLog SyncLog_apiKeyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SyncLog"
    ADD CONSTRAINT "SyncLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES public."ApiKey"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Tag Tag_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tag"
    ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Trade Trade_apiKeyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Trade"
    ADD CONSTRAINT "Trade_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES public."ApiKey"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Trade Trade_legId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Trade"
    ADD CONSTRAINT "Trade_legId_fkey" FOREIGN KEY ("legId") REFERENCES public."Leg"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UserSettings UserSettings_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserSettings"
    ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _LegTags _LegTags_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."_LegTags"
    ADD CONSTRAINT "_LegTags_A_fkey" FOREIGN KEY ("A") REFERENCES public."Leg"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _LegTags _LegTags_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."_LegTags"
    ADD CONSTRAINT "_LegTags_B_fkey" FOREIGN KEY ("B") REFERENCES public."Tag"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict Lv5wbfXakKN8i7cYBeJfbQswqlojhrHxT6MDQiqIgD1xpbWDo99LRHXfiedbTsH

