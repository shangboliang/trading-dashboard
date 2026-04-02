export const MOCK_SUMMARY = {
    "countTraders": 83,
    "countTradersInLongPosition": 40,
    "countTradersInShortPosition": 24,
    "countPositions": 429,
    "totalRealisedPnL": 88.4162341,
    "avgRealisedPnL": 1.768324682,
    "avgDuration": 161694,
    "wins": {
        "countLegs": 23,
        "totalRealisedPnL": 272.21635114,
        "avgRealisedPnL": 11.835493527826086,
    },
    "loss": {
        "countLegs": 27,
        "totalRealisedPnL": -183.80011704,
        "avgRealisedPnL": -6.8074117422222225,
    }
};

export const MOCK_LEGS = [
    {
        "id": 5206,
        "symbol": "ZBTUSDT",
        "side": "buy",
        "openDate": "2026-03-29T12:09:08.527Z",
        "closeDate": "2026-03-29T13:09:17.630Z",
        "averageEntry": 0.0736,
        "averageExit": 0.07341,
        "realisedPnLusd": -0.28850287,
        "duration": 3609,
        "sizeUsd": 175.67695,
        "commission": -0.06145287,
        "result": "loss"
    },
    {
        "id": 5205,
        "symbol": "HUSDT",
        "side": "buy",
        "openDate": "2026-03-29T04:54:36.134Z",
        "closeDate": "2026-03-29T07:27:01.732Z",
        "averageEntry": 0.08502,
        "averageExit": 0.08271,
        "realisedPnLusd": -3.05832752,
        "duration": 9146,
        "sizeUsd": 218.88765,
        "commission": -0.04377752,
        "result": "loss"
    },
    {
        "id": 5203,
        "symbol": "TAOUSDT",
        "side": "buy",
        "openDate": "2026-03-28T03:22:04.427Z",
        "closeDate": "2026-03-29T07:26:37.695Z",
        "averageEntry": 317.85,
        "averageExit": 318.74,
        "realisedPnLusd": 0.36499112,
        "duration": 101073,
        "sizeUsd": 299.83389,
        "commission": -0.05996677,
        "result": "win"
    }
];

export const MOCK_DATETIME = {
    "weekdays": [
        {
            "rangeStart": 1,
            "rangeEnd": 2,
            "countLegs": 9,
            "totalRealisedPnL": 36.21837302,
            "wins": { "countLegs": 5, "totalRealisedPnL": 57.29027883 },
            "loss": { "countLegs": 4, "totalRealisedPnL": -21.07190581 }
        },
        {
            "rangeStart": 2,
            "rangeEnd": 3,
            "countLegs": 1,
            "totalRealisedPnL": 2.76088556,
            "wins": { "countLegs": 1, "totalRealisedPnL": 2.76088556 },
            "loss": { "countLegs": 0, "totalRealisedPnL": 0 }
        }
    ],
    "oneHours": [
        {
            "rangeStart": 0,
            "rangeEnd": 1,
            "countLegs": 3,
            "totalRealisedPnL": -13.18553339,
            "wins": { "countLegs": 1, "totalRealisedPnL": 6.50859314 },
            "loss": { "countLegs": 2, "totalRealisedPnL": -19.69412653 }
        }
    ]
};

export const MOCK_SIZE = [
    {
        "rangeStart": 54.97678,
        "rangeEnd": 133.0759,
        "countLegs": 22,
        "totalRealisedPnL": -23.79218029,
        "wins": { "countLegs": 7, "totalRealisedPnL": 61.85003607 },
        "loss": { "countLegs": 15, "totalRealisedPnL": -85.64221636 }
    },
    {
        "rangeStart": 133.0759,
        "rangeEnd": 211.175,
        "countLegs": 13,
        "totalRealisedPnL": 47.10438854,
        "wins": { "countLegs": 7, "totalRealisedPnL": 77.20829949 },
        "loss": { "countLegs": 6, "totalRealisedPnL": -30.10391095 }
    }
];

export const MOCK_DURATION = [
    {
        "rangeStart": 13,
        "rangeEnd": 64682.944,
        "countLegs": 22,
        "totalRealisedPnL": 0.33529527,
        "wins": { "countLegs": 8, "totalRealisedPnL": 83.13024791 },
        "loss": { "countLegs": 14, "totalRealisedPnL": -82.79495264 }
    }
];

export const MOCK_CANDLES = {
    "history": [
        { "dateOpen": "2026-03-29T09:19:00Z", "open": 0.07034, "high": 0.07041, "low": 0.07026, "close": 0.07038 },
        { "dateOpen": "2026-03-29T09:20:00Z", "open": 0.07037, "high": 0.07049, "low": 0.07035, "close": 0.07047 }
    ]
};
