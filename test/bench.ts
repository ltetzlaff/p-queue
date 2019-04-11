import Benchmark from 'benchmark';
import PQueue from '../source';

const suite = new Benchmark.Suite();

suite
	.add('baseline', {
		defer: true,

		fn: async deferred => {
			const queue = new PQueue();

			for (let i = 0; i < 100; i++) {
				queue.add(async () => {});
			}

			await queue.onEmpty();
			deferred.resolve();
		}
	})
	.add('operation with random priority', {
		defer: true,

		fn: async deferred => {
			const queue = new PQueue();

			for (let i = 0; i < 100; i++) {
				queue.add(async () => {}, {
					priority: (Math.random() * 100) | 0
				});
			}

			await queue.onEmpty();
			deferred.resolve();
		}
	})
	.add('operation with increasing priority', {
		defer: true,

		fn: async deferred => {
			const queue = new PQueue();

			for (let i = 0; i < 100; i++) {
				queue.add(async () => {}, {
					priority: i
				});
			}

			await queue.onEmpty();
			deferred.resolve();
		}
	})
	.on('cycle', event => {
		console.log(String(event.target));
	})
	.on('complete', function () {
		console.log(`Fastest is ${this.filter('fastest').map('name')}`);
	})
	.run({
		async: true
	});
