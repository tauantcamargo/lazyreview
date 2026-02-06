import { Bench } from 'tinybench';

type Item = {
  title: string;
  description: string;
};

const items: Item[] = Array.from({ length: 2000 }, (_, index) => ({
  title: `PR #${index + 1} Improve performance`,
  description: `repo-${(index % 7) + 1} updated ${(index % 13) + 1}h ago`,
}));

const query = 'performance';
const lowered = query.toLowerCase();

const bench = new Bench({ time: 1000 });

bench.add('filter-2000', () => {
  items.filter((item) => {
    return item.title.toLowerCase().includes(lowered) || item.description.toLowerCase().includes(lowered);
  });
});

bench.add('visible-range', () => {
  const height = 18;
  const itemHeight = 2;
  const visibleCount = Math.max(1, Math.floor(height / itemHeight));
  const cursor = 742;
  const maxStart = Math.max(0, items.length - visibleCount);
  const start = Math.min(Math.max(cursor - Math.floor(visibleCount / 2), 0), maxStart);
  const end = Math.min(start + visibleCount, items.length);
  items.slice(start, end);
});

await bench.run();

console.table(
  bench.tasks.map((task) => ({
    name: task.name,
    ops: Math.round(task.result?.hz ?? 0),
    meanMs: Number(((task.result?.mean ?? 0) * 1000).toFixed(3)),
  }))
);
