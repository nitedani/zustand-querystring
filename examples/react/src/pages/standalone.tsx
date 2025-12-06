import { Link } from "react-router-dom";
import { create } from "zustand";
import { querystring, flat, compact } from "zustand-querystring";

interface StandaloneStore {
  // Primitives
  query: string;
  count: number;
  enabled: boolean;
  nullValue: null;
  undefinedValue: undefined;

  // Complex types
  filters: {
    filter1: string[];
    filter2: number[];
  };
  nested: {
    deep: {
      value: string;
    };
  };
  date: Date;

  // Actions
  setQuery: (query: string) => void;
  setCount: (count: number) => void;
  toggleEnabled: () => void;
  setFilters: (filters: string[]) => void;
  addFilter: (filter: string) => void;
  removeFilter: (filter: string) => void;
  setDeepValue: (value: string) => void;
  setDate: (date: Date) => void;
}

const useStandaloneStore = create<StandaloneStore>()(
  querystring(
    (set) => ({
      query: "",
      count: 0,
      enabled: false,
      nullValue: null,
      undefinedValue: undefined,
      filters: {
        filter1: [],
        filter2: [],
      },
      nested: {
        deep: {
          value: "initial",
        },
      },
      date: new Date(),
      setQuery: (query: string) => set({ query }),
      setCount: (count: number) => set({ count }),
      toggleEnabled: () => set((state) => ({ enabled: !state.enabled })),
      setFilters: (filter1: string[]) =>
        set((state) => ({ filters: { ...state.filters, filter1 } })),
      addFilter: (filter: string) =>
        set((state) => ({
          filters: {
            ...state.filters,
            filter1: [...state.filters.filter1, filter],
          },
        })),
      removeFilter: (filter: string) =>
        set((state) => ({
          filters: {
            ...state.filters,
            filter1: state.filters.filter1.filter((f) => f !== filter),
          },
        })),
      setDeepValue: (value: string) =>
        set((state) => ({
          nested: { ...state.nested, deep: { value } },
        })),
      setDate: (date: Date) => set({ date }),
    }),
    {
      format: compact,
      key: false,
      select: () => ({
        query: true,
        count: true,
        enabled: true,
        nullValue: true,
        filters: true,
        nested: true,
        date: true,
      }),
    },
  ),
);

// Second standalone store to test multiple stores on same page
interface SecondStore {
  page: number;
  sort: string;
  setPage: (page: number) => void;
  setSort: (sort: string) => void;
}

const useSecondStore = create<SecondStore>()(
  querystring(
    (set) => ({
      page: 1,
      sort: "name",
      setPage: (page: number) => set({ page }),
      setSort: (sort: string) => set({ sort }),
    }),
    {
      format: compact,
      key: false,
      select: () => ({
        page: true,
        sort: true,
      }),
    },
  ),
);

// Third store using flat format - demonstrates dot notation and repeated keys
interface FlatStore {
  search: string;
  filters: {
    categories: string[];
    price: {
      min: number;
      max: number;
    };
  };
  setSearch: (search: string) => void;
  addCategory: (category: string) => void;
  prependCategory: (category: string) => void;
  removeCategory: (category: string) => void;
  updateCategory: (index: number, value: string) => void;
  setPrice: (min: number, max: number) => void;
}

const useFlatStore = create<FlatStore>()(
  querystring(
    (set) => ({
      search: "",
      filters: {
        categories: [],
        price: {
          min: 0,
          max: 1000,
        },
      },
      setSearch: (search: string) => set({ search }),
      addCategory: (category: string) =>
        set((state) => ({
          filters: {
            ...state.filters,
            categories: [...state.filters.categories, category],
          },
        })),
      prependCategory: (category: string) =>
        set((state) => ({
          filters: {
            ...state.filters,
            categories: [category, ...state.filters.categories],
          },
        })),
      removeCategory: (category: string) =>
        set((state) => ({
          filters: {
            ...state.filters,
            categories: state.filters.categories.filter((c) => c !== category),
          },
        })),
      updateCategory: (index: number, value: string) =>
        set((state) => ({
          filters: {
            ...state.filters,
            categories: state.filters.categories.map((c, i) =>
              i === index ? value : c
            ),
          },
        })),
      setPrice: (min: number, max: number) =>
        set((state) => ({
          filters: {
            ...state.filters,
            price: { min, max },
          },
        })),
    }),
    {
      format: flat,
      key: false,
      prefix: "flat_",
      select: () => ({
        search: true,
        filters: true,
      }),
    },
  ),
);

export function Standalone() {
  const {
    query,
    count,
    enabled,
    nullValue,
    filters,
    nested,
    date,
    setQuery,
    setCount,
    toggleEnabled,
    addFilter,
    removeFilter,
    setDeepValue,
    setDate,
  } = useStandaloneStore();

  const { page, sort, setPage, setSort } = useSecondStore();

  const {
    search,
    filters: flatFilters,
    setSearch,
    addCategory,
    prependCategory,
    removeCategory,
    updateCategory,
    setPrice,
  } = useFlatStore();

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Standalone Mode Example</h1>
      <p>
        <Link to="/">Home</Link> | <Link to="/about">About</Link> |{" "}
        <strong>Standalone</strong>
      </p>

      <div
        style={{
          marginTop: "20px",
          padding: "16px",
          background: "#e3f2fd",
          borderRadius: "8px",
        }}
      >
        <h2>Second Store (Pagination)</h2>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <div>
            <label style={{ marginRight: "8px" }}>Page:</label>
            <input
              type="number"
              value={page}
              onChange={(e) => setPage(Number(e.target.value))}
              style={{ padding: "8px", width: "80px" }}
              min="1"
            />
          </div>
          <div>
            <label style={{ marginRight: "8px" }}>Sort by:</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{ padding: "8px" }}
            >
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="price">Price</option>
            </select>
          </div>
        </div>
        <p style={{ marginTop: "12px", fontSize: "14px", color: "#555" }}>
          This demonstrates two standalone stores working on the same page
          without conflicts.
        </p>
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "16px",
          background: "#fff3e0",
          borderRadius: "8px",
        }}
      >
        <h2>Third Store (Flat Format)</h2>
        <p style={{ fontSize: "14px", color: "#555", marginBottom: "16px" }}>
          Uses dot notation for nested objects and repeated keys for arrays.
          <br />
          URL format: <code>flat_search=term&flat_filters.categories=a&flat_filters.categories=b&flat_filters.price.min=0</code>
        </p>
        
        <div style={{ marginBottom: "16px" }}>
          <label style={{ marginRight: "8px" }}>Search:</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search term..."
            style={{ padding: "8px", width: "200px" }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ marginRight: "8px" }}>Categories:</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            {flatFilters.categories.map((cat, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ color: "#666", minWidth: "20px" }}>{index}:</span>
                <input
                  type="text"
                  value={cat}
                  onChange={(e) => updateCategory(index, e.target.value)}
                  style={{ padding: "4px 8px", width: "120px" }}
                />
                <button
                  onClick={() => removeCategory(cat)}
                  style={{
                    background: "#f44336",
                    color: "white",
                    border: "none",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
            <input
              type="text"
              id="categoryInput"
              placeholder="New category..."
              style={{ padding: "8px", width: "150px" }}
            />
            <button
              onClick={() => {
                const input = document.getElementById("categoryInput") as HTMLInputElement;
                if (input.value) {
                  prependCategory(input.value);
                  input.value = "";
                }
              }}
              style={{ padding: "8px 16px", background: "#2196f3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Prepend
            </button>
            <button
              onClick={() => {
                const input = document.getElementById("categoryInput") as HTMLInputElement;
                if (input.value) {
                  addCategory(input.value);
                  input.value = "";
                }
              }}
              style={{ padding: "8px 16px", background: "#4caf50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Append
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "20px" }}>
          <div>
            <label style={{ marginRight: "8px" }}>Min Price:</label>
            <input
              type="number"
              value={flatFilters.price.min}
              onChange={(e) =>
                setPrice(Number(e.target.value), flatFilters.price.max)
              }
              style={{ padding: "8px", width: "80px" }}
            />
          </div>
          <div>
            <label style={{ marginRight: "8px" }}>Max Price:</label>
            <input
              type="number"
              value={flatFilters.price.max}
              onChange={(e) =>
                setPrice(flatFilters.price.min, Number(e.target.value))
              }
              style={{ padding: "8px", width: "80px" }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h2>String</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter search query..."
          style={{ padding: "8px", width: "300px" }}
        />
        <p>Current query: {query || "(empty)"}</p>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h2>Number</h2>
        <input
          type="number"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          style={{ padding: "8px", width: "100px" }}
        />
        <p>Count: {count}</p>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h2>Boolean</h2>
        <label>
          <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
          Enabled
        </label>
        <p>Enabled: {String(enabled)}</p>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h2>Null Value</h2>
        <p>Null: {String(nullValue)}</p>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h2>Array of Strings</h2>
        <div>
          <input
            type="text"
            id="filterInput"
            placeholder="Enter filter value..."
            style={{ padding: "8px", width: "200px" }}
          />
          <button
            onClick={() => {
              const input = document.getElementById(
                "filterInput",
              ) as HTMLInputElement;
              if (input.value) {
                addFilter(input.value);
                input.value = "";
              }
            }}
            style={{ marginLeft: "8px", padding: "8px 16px" }}
          >
            Add Filter
          </button>
        </div>

        <div style={{ marginTop: "16px" }}>
          <strong>Active filters:</strong>
          {filters.filter1.length === 0 ? (
            <p>(none)</p>
          ) : (
            <ul>
              {filters.filter1.map((filter) => (
                <li key={filter}>
                  {filter}
                  <button
                    onClick={() => removeFilter(filter)}
                    style={{ marginLeft: "8px" }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h2>Nested Object</h2>
        <input
          type="text"
          value={nested.deep.value}
          onChange={(e) => setDeepValue(e.target.value)}
          placeholder="Deep nested value..."
          style={{ padding: "8px", width: "300px" }}
        />
        <p>Deep value: {nested.deep.value}</p>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h2>Date</h2>
        <input
          type="datetime-local"
          value={date.toISOString().slice(0, 16)}
          onChange={(e) => setDate(new Date(e.target.value))}
          style={{ padding: "8px" }}
        />
        <p>Date: {date.toISOString()}</p>
      </div>

      <div
        style={{ marginTop: "30px", padding: "16px", background: "#f5f5f5" }}
      >
        <h3>Store 1 State (readable format):</h3>
        <pre>
          {JSON.stringify(
            { query, count, enabled, nullValue, filters, nested, date },
            null,
            2,
          )}
        </pre>

        <h3 style={{ marginTop: "20px" }}>Store 2 State (readable format):</h3>
        <pre>{JSON.stringify({ page, sort }, null, 2)}</pre>

        <h3 style={{ marginTop: "20px" }}>Store 3 State (flat format with prefix):</h3>
        <pre>{JSON.stringify({ search, filters: flatFilters }, null, 2)}</pre>

        <p style={{ marginTop: "8px", color: "#666" }}>
          <strong>URL formats:</strong>
          <br />
          • <strong>readable:</strong> Compact serialization with type markers
          <br />
          • <strong>flat:</strong> Dot notation for nesting, repeated keys for arrays (human-readable/editable)
        </p>
      </div>
    </div>
  );
}
