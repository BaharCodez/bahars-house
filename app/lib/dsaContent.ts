// Per-pattern study material for the DSA roadmap: a visual kind, a code
// template, and a few NeetCode/LeetCode problems to drill it. Keyed by the
// exact step title.

export interface PatternContent {
  viz?: string; // matches a case in PatternViz
  template: string;
  problems: { name: string; url: string }[];
}

const lc = (slug: string) => `https://leetcode.com/problems/${slug}/`;

export const DSA_CONTENT: Record<string, PatternContent> = {
  "Hashing / frequency counting": {
    template: `seen = {}                 # value -> index / count
for i, x in enumerate(nums):
    if target - x in seen:
        return [seen[target - x], i]
    seen[x] = i`,
    problems: [
      { name: "Two Sum", url: lc("two-sum") },
      { name: "Group Anagrams", url: lc("group-anagrams") },
      { name: "Contains Duplicate", url: lc("contains-duplicate") },
    ],
  },
  "Two pointers": {
    viz: "two-pointers",
    template: `l, r = 0, len(a) - 1
while l < r:
    if cond(a[l], a[r]): return ...
    elif a[l] + a[r] < target: l += 1
    else: r -= 1`,
    problems: [
      { name: "Valid Palindrome", url: lc("valid-palindrome") },
      { name: "3Sum", url: lc("3sum") },
      {
        name: "Container With Most Water",
        url: lc("container-with-most-water"),
      },
    ],
  },
  "Sliding window": {
    viz: "sliding-window",
    template: `l = 0
for r in range(len(s)):
    add(s[r])
    while invalid():
        remove(s[l]); l += 1
    best = max(best, r - l + 1)`,
    problems: [
      {
        name: "Best Time to Buy/Sell Stock",
        url: lc("best-time-to-buy-and-sell-stock"),
      },
      {
        name: "Longest Substring w/o Repeat",
        url: lc("longest-substring-without-repeating-characters"),
      },
      {
        name: "Longest Repeating Char Replace",
        url: lc("longest-repeating-character-replacement"),
      },
    ],
  },
  "Prefix sums": {
    viz: "prefix-sum",
    template: `pref = 0; seen = {0: 1}
for x in nums:
    pref += x
    count += seen.get(pref - k, 0)
    seen[pref] = seen.get(pref, 0) + 1`,
    problems: [
      { name: "Subarray Sum Equals K", url: lc("subarray-sum-equals-k") },
      {
        name: "Product of Array Except Self",
        url: lc("product-of-array-except-self"),
      },
      { name: "Range Sum Query", url: lc("range-sum-query-immutable") },
    ],
  },
  "Monotonic stack": {
    template: `stack = []                 # indices, values decreasing
for i, x in enumerate(nums):
    while stack and nums[stack[-1]] < x:
        j = stack.pop(); res[j] = i - j
    stack.append(i)`,
    problems: [
      { name: "Daily Temperatures", url: lc("daily-temperatures") },
      {
        name: "Largest Rectangle in Histogram",
        url: lc("largest-rectangle-in-histogram"),
      },
      { name: "Next Greater Element I", url: lc("next-greater-element-i") },
    ],
  },
  "Binary search (incl. on the answer)": {
    viz: "binary-search",
    template: `lo, hi = 0, n - 1
while lo <= hi:
    mid = (lo + hi) // 2
    if ok(mid): hi = mid - 1   # or return mid
    else: lo = mid + 1
return lo`,
    problems: [
      { name: "Binary Search", url: lc("binary-search") },
      { name: "Koko Eating Bananas", url: lc("koko-eating-bananas") },
      {
        name: "Find Min in Rotated Array",
        url: lc("find-minimum-in-rotated-sorted-array"),
      },
    ],
  },
  "Fast & slow pointers": {
    viz: "fast-slow",
    template: `slow = fast = head
while fast and fast.next:
    slow = slow.next
    fast = fast.next.next
    if slow is fast: return True   # cycle`,
    problems: [
      { name: "Linked List Cycle", url: lc("linked-list-cycle") },
      {
        name: "Find the Duplicate Number",
        url: lc("find-the-duplicate-number"),
      },
      {
        name: "Middle of the Linked List",
        url: lc("middle-of-the-linked-list"),
      },
    ],
  },
  "In-place reversal": {
    template: `prev = None; cur = head
while cur:
    nxt = cur.next
    cur.next = prev
    prev = cur; cur = nxt
return prev`,
    problems: [
      { name: "Reverse Linked List", url: lc("reverse-linked-list") },
      { name: "Reverse Linked List II", url: lc("reverse-linked-list-ii") },
      { name: "Reverse Nodes in k-Group", url: lc("reverse-nodes-in-k-group") },
    ],
  },
  "DFS & backtracking": {
    viz: "dfs",
    template: `def dfs(i, path):
    if done(i): res.append(path[:]); return
    for choice in options(i):
        path.append(choice)      # choose
        dfs(i + 1, path)
        path.pop()               # un-choose`,
    problems: [
      { name: "Subsets", url: lc("subsets") },
      { name: "Combination Sum", url: lc("combination-sum") },
      { name: "Word Search", url: lc("word-search") },
    ],
  },
  BFS: {
    viz: "bfs",
    template: `q = deque([start]); seen = {start}
while q:
    node = q.popleft()
    for nb in neighbors(node):
        if nb not in seen:
            seen.add(nb); q.append(nb)`,
    problems: [
      {
        name: "Binary Tree Level Order",
        url: lc("binary-tree-level-order-traversal"),
      },
      { name: "Rotting Oranges", url: lc("rotting-oranges") },
      { name: "Number of Islands", url: lc("number-of-islands") },
    ],
  },
  "Union-Find (DSU)": {
    template: `parent = list(range(n))
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]; x = parent[x]
    return x
def union(a, b): parent[find(a)] = find(b)`,
    problems: [
      {
        name: "Number of Connected Components",
        url: lc("number-of-connected-components-in-an-undirected-graph"),
      },
      { name: "Redundant Connection", url: lc("redundant-connection") },
      { name: "Graph Valid Tree", url: lc("graph-valid-tree") },
    ],
  },
  "Topological sort": {
    template: `indeg = Counter(); q = deque(n0 for n0 if indeg[n0]==0)
while q:
    u = q.popleft(); order.append(u)
    for v in adj[u]:
        indeg[v] -= 1
        if indeg[v] == 0: q.append(v)`,
    problems: [
      { name: "Course Schedule", url: lc("course-schedule") },
      { name: "Course Schedule II", url: lc("course-schedule-ii") },
      { name: "Alien Dictionary", url: lc("alien-dictionary") },
    ],
  },
  Trie: {
    template: `class Trie:
    def __init__(self): self.kids = {}; self.end = False
    def insert(self, w):
        node = self
        for ch in w: node = node.kids.setdefault(ch, Trie())
        node.end = True`,
    problems: [
      { name: "Implement Trie", url: lc("implement-trie-prefix-tree") },
      {
        name: "Design Add & Search Words",
        url: lc("design-add-and-search-words-data-structure"),
      },
      { name: "Word Search II", url: lc("word-search-ii") },
    ],
  },
  "Dijkstra (weighted shortest path)": {
    template: `pq = [(0, src)]; dist = {src: 0}
while pq:
    d, u = heappop(pq)
    if d > dist.get(u, inf): continue
    for v, w in adj[u]:
        if d + w < dist.get(v, inf):
            dist[v] = d + w; heappush(pq, (d + w, v))`,
    problems: [
      { name: "Network Delay Time", url: lc("network-delay-time") },
      {
        name: "Cheapest Flights K Stops",
        url: lc("cheapest-flights-within-k-stops"),
      },
      { name: "Path With Minimum Effort", url: lc("path-with-minimum-effort") },
    ],
  },
  "Heap / Top-K": {
    template: `import heapq
heap = []
for x in nums:
    heapq.heappush(heap, x)
    if len(heap) > k: heapq.heappop(heap)
return heap[0]                 # kth largest`,
    problems: [
      {
        name: "Kth Largest Element",
        url: lc("kth-largest-element-in-an-array"),
      },
      { name: "Top K Frequent Elements", url: lc("top-k-frequent-elements") },
      {
        name: "Find Median from Data Stream",
        url: lc("find-median-from-data-stream"),
      },
    ],
  },
  Intervals: {
    template: `intervals.sort(key=lambda x: x[0])
res = [intervals[0]]
for s, e in intervals[1:]:
    if s <= res[-1][1]: res[-1][1] = max(res[-1][1], e)
    else: res.append([s, e])`,
    problems: [
      { name: "Merge Intervals", url: lc("merge-intervals") },
      { name: "Insert Interval", url: lc("insert-interval") },
      {
        name: "Non-overlapping Intervals",
        url: lc("non-overlapping-intervals"),
      },
    ],
  },
  "1D DP": {
    template: `dp = [0] * (n + 1)
dp[1] = 1
for i in range(2, n + 1):
    dp[i] = dp[i-1] + dp[i-2]   # recurrence
return dp[n]`,
    problems: [
      { name: "Climbing Stairs", url: lc("climbing-stairs") },
      { name: "House Robber", url: lc("house-robber") },
      {
        name: "Longest Increasing Subsequence",
        url: lc("longest-increasing-subsequence"),
      },
    ],
  },
  "2D DP / grids": {
    viz: "dp-grid",
    template: `dp = [[0]*(n+1) for _ in range(m+1)]
for i in range(1, m+1):
    for j in range(1, n+1):
        dp[i][j] = f(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
return dp[m][n]`,
    problems: [
      { name: "Unique Paths", url: lc("unique-paths") },
      {
        name: "Longest Common Subsequence",
        url: lc("longest-common-subsequence"),
      },
      { name: "Edit Distance", url: lc("edit-distance") },
    ],
  },
  Knapsack: {
    template: `dp = [0] * (cap + 1)
for w, val in items:            # 0/1: iterate cap high->low
    for c in range(cap, w - 1, -1):
        dp[c] = max(dp[c], dp[c - w] + val)
return dp[cap]`,
    problems: [
      {
        name: "Partition Equal Subset Sum",
        url: lc("partition-equal-subset-sum"),
      },
      { name: "Coin Change", url: lc("coin-change") },
      { name: "Target Sum", url: lc("target-sum") },
    ],
  },
  Greedy: {
    template: `# sort by the right key, then take greedily
items.sort(key=...)
for x in items:
    if feasible(x): take(x)`,
    problems: [
      { name: "Maximum Subarray", url: lc("maximum-subarray") },
      { name: "Jump Game", url: lc("jump-game") },
      { name: "Gas Station", url: lc("gas-station") },
    ],
  },
  Backtracking: {
    viz: "dfs",
    template: `def bt(start, path):
    res.append(path[:])
    for i in range(start, len(nums)):
        path.append(nums[i])
        bt(i + 1, path)
        path.pop()`,
    problems: [
      { name: "Subsets", url: lc("subsets") },
      { name: "Permutations", url: lc("permutations") },
      { name: "N-Queens", url: lc("n-queens") },
    ],
  },
  "Bit manipulation": {
    template: `res = 0
for x in nums: res ^= x       # single number
x & (x - 1)                    # drop lowest set bit
(x >> i) & 1                   # read bit i`,
    problems: [
      { name: "Single Number", url: lc("single-number") },
      { name: "Number of 1 Bits", url: lc("number-of-1-bits") },
      { name: "Counting Bits", url: lc("counting-bits") },
    ],
  },
};
