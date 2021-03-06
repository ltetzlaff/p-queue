import EventEmitter from 'eventemitter3';
import test from 'ava';
import delay from 'delay';
import inRange from 'in-range';
import timeSpan from 'time-span';
import randomInt from 'random-int';
import PQueue from '.';

const fixture = Symbol('fixture');

test('.add()', async t => {
	const queue = new PQueue();
	const p = queue.add(async () => fixture);
	t.is(queue.size, 0);
	t.is(queue.pending, 1);
	t.is(await p, fixture);
});

test('.add() - limited concurrency', async t => {
	const queue = new PQueue({concurrency: 2});
	const p = queue.add(async () => fixture);
	const p2 = queue.add(async () => {
		await delay(100);
		return fixture;
	});
	const p3 = queue.add(async () => fixture);
	t.is(queue.size, 1);
	t.is(queue.pending, 2);
	t.is(await p, fixture);
	t.is(await p2, fixture);
	t.is(await p3, fixture);
});

test('.add() - concurrency: 1', async t => {
	const input = [
		[10, 300],
		[20, 200],
		[30, 100]
	];

	const end = timeSpan();
	const queue = new PQueue({concurrency: 1});
	const mapper = ([value, ms]) => queue.add(async () => {
		await delay(ms);
		return value;
	});

	t.deepEqual(await Promise.all(input.map(mapper)), [10, 20, 30]);
	t.true(inRange(end(), 590, 650));
});

test('.add() - concurrency: 5', async t => {
	const concurrency = 5;
	const queue = new PQueue({concurrency});
	let running = 0;

	const input = new Array(100).fill(0).map(() => queue.add(async () => {
		running++;
		t.true(running <= concurrency);
		t.true(queue.pending <= concurrency);
		await delay(randomInt(30, 200));
		running--;
	}));

	await Promise.all(input);
});

test('.add() - priority', async t => {
	const result = [];
	const queue = new PQueue({concurrency: 1});
	queue.add(async () => result.push(1), {priority: 1});
	queue.add(async () => result.push(0), {priority: 0});
	queue.add(async () => result.push(1), {priority: 1});
	queue.add(async () => result.push(2), {priority: 1});
	queue.add(async () => result.push(3), {priority: 2});
	queue.add(async () => result.push(0), {priority: -1});
	await queue.onEmpty();
	t.deepEqual(result, [1, 3, 1, 2, 0, 0]);
});

test('.onEmpty()', async t => {
	const queue = new PQueue({concurrency: 1});

	queue.add(async () => 0);
	queue.add(async () => 0);
	t.is(queue.size, 1);
	t.is(queue.pending, 1);
	await queue.onEmpty();
	t.is(queue.size, 0);

	queue.add(async () => 0);
	queue.add(async () => 0);
	t.is(queue.size, 1);
	t.is(queue.pending, 1);
	await queue.onEmpty();
	t.is(queue.size, 0);

	// Test an empty queue
	await queue.onEmpty();
	t.is(queue.size, 0);
});

test('.onIdle()', async t => {
	const queue = new PQueue({concurrency: 2});

	queue.add(async () => delay(100));
	queue.add(async () => delay(100));
	queue.add(async () => delay(100));
	t.is(queue.size, 1);
	t.is(queue.pending, 2);
	await queue.onIdle();
	t.is(queue.size, 0);
	t.is(queue.pending, 0);

	queue.add(async () => delay(100));
	queue.add(async () => delay(100));
	queue.add(async () => delay(100));
	t.is(queue.size, 1);
	t.is(queue.pending, 2);
	await queue.onIdle();
	t.is(queue.size, 0);
	t.is(queue.pending, 0);
});

test('.onIdle() - no pending', async t => {
	const queue = new PQueue();

	t.is(queue.size, 0);
	t.is(queue.pending, 0);

	const p = await queue.onIdle();

	t.is(p, undefined);
});

test('.clear()', t => {
	const queue = new PQueue({concurrency: 2});
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	t.is(queue.size, 4);
	t.is(queue.pending, 2);
	queue.clear();
	t.is(queue.size, 0);
});

test('.addAll()', async t => {
	const queue = new PQueue();
	const fn = async () => fixture;
	const fns = [fn, fn];
	const p = queue.addAll(fns);
	t.is(queue.size, 0);
	t.is(queue.pending, 2);
	t.deepEqual(await p, [fixture, fixture]);
});

test('enforce number in options.concurrency', t => {
	/* eslint-disable no-new */
	t.throws(() => {
		new PQueue({concurrency: 0});
	}, TypeError);
	t.throws(() => {
		new PQueue({concurrency: undefined});
	}, TypeError);
	t.notThrows(() => {
		new PQueue({concurrency: 1});
	});
	t.notThrows(() => {
		new PQueue({concurrency: 10});
	});
	t.notThrows(() => {
		new PQueue({concurrency: Infinity});
	});
	/* eslint-enable no-new */
});

test('enforce number in options.intervalCap', t => {
	/* eslint-disable no-new */
	t.throws(() => {
		new PQueue({intervalCap: 0});
	}, TypeError);
	t.throws(() => {
		new PQueue({intervalCap: undefined});
	}, TypeError);
	t.notThrows(() => {
		new PQueue({intervalCap: 1});
	});
	t.notThrows(() => {
		new PQueue({intervalCap: 10});
	});
	t.notThrows(() => {
		new PQueue({intervalCap: Infinity});
	});
	/* eslint-enable no-new */
});

test('enforce finite in options.interval', t => {
	/* eslint-disable no-new */
	t.throws(() => {
		new PQueue({interval: -1});
	}, TypeError);
	t.throws(() => {
		new PQueue({interval: undefined});
	}, TypeError);
	t.throws(() => {
		new PQueue({interval: Infinity});
	});
	t.notThrows(() => {
		new PQueue({interval: 0});
	});
	t.notThrows(() => {
		new PQueue({interval: 10});
	});
	t.throws(() => {
		new PQueue({interval: Infinity});
	});
	/* eslint-enable no-new */
});

test('autoStart: false', t => {
	const queue = new PQueue({concurrency: 2, autoStart: false});

	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	t.is(queue.size, 4);
	t.is(queue.pending, 0);
	t.is(queue.isPaused, true);

	queue.start();
	t.is(queue.size, 2);
	t.is(queue.pending, 2);
	t.is(queue.isPaused, false);

	queue.clear();
	t.is(queue.size, 0);
});

test('.start() - not paused', t => {
	const queue = new PQueue();

	t.falsy(queue.isPaused);

	queue.start();

	t.falsy(queue.isPaused);
});

test('.pause()', t => {
	const queue = new PQueue({concurrency: 2});

	queue.pause();
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	queue.add(() => delay(20000));
	t.is(queue.size, 5);
	t.is(queue.pending, 0);
	t.is(queue.isPaused, true);

	queue.start();
	t.is(queue.size, 3);
	t.is(queue.pending, 2);
	t.is(queue.isPaused, false);

	queue.add(() => delay(20000));
	queue.pause();
	t.is(queue.size, 4);
	t.is(queue.pending, 2);
	t.is(queue.isPaused, true);

	queue.start();
	t.is(queue.size, 4);
	t.is(queue.pending, 2);
	t.is(queue.isPaused, false);

	queue.clear();
	t.is(queue.size, 0);
});

test('.add() sync/async mixed tasks', async t => {
	const queue = new PQueue({concurrency: 1});
	queue.add(() => 'sync 1');
	queue.add(() => delay(1000));
	queue.add(() => 'sync 2');
	queue.add(() => fixture);
	t.is(queue.size, 3);
	t.is(queue.pending, 1);
	await queue.onIdle();
	t.is(queue.size, 0);
	t.is(queue.pending, 0);
});

test('.add() - handle task throwing error', async t => {
	const queue = new PQueue({concurrency: 1});

	queue.add(() => 'sync 1');
	t.throwsAsync(queue.add(() => {
		throw new Error('broken');
	}), 'broken');
	queue.add(() => 'sync 2');

	t.is(queue.size, 2);

	await queue.onIdle();
});

test('.add() - handle task promise failure', async t => {
	const queue = new PQueue({concurrency: 1});

	t.throwsAsync(queue.add(async () => {
		throw new Error('broken');
	}), 'broken');

	queue.add(() => 'task #1');

	t.is(queue.pending, 1);

	await queue.onIdle();

	t.is(queue.pending, 0);
});

test('.addAll() sync/async mixed tasks', async t => {
	const queue = new PQueue();
	const fns = [
		() => 'sync 1',
		() => delay(2000),
		() => 'sync 2',
		async () => fixture
	];
	const p = queue.addAll(fns);
	t.is(queue.size, 0);
	t.is(queue.pending, 4);
	t.deepEqual(await p, ['sync 1', undefined, 'sync 2', fixture]);
});

test('should resolve empty when size is zero', async t => {
	const queue = new PQueue({concurrency: 1, autoStart: false});

	// It should take 1 seconds to resolve all tasks
	for (let index = 0; index < 100; index++) {
		queue.add(() => delay(10));
	}

	(async () => {
		await queue.onEmpty();
		t.is(queue.size, 0);
	})();

	queue.start();

	// Pause at 0.5 second
	setTimeout(async () => {
		queue.pause();
		await delay(10);
		queue.start();
	}, 500);

	await queue.onIdle();
});

test('.add() - throttled', async t => {
	const result = [];
	const queue = new PQueue({
		intervalCap: 1,
		interval: 500,
		autoStart: false
	});
	queue.add(() => result.push(1));
	queue.start();
	await delay(250);
	queue.add(() => result.push(2));
	t.deepEqual(result, [1]);
	await delay(300);
	t.deepEqual(result, [1, 2]);
});

test('.add() - throttled, carryoverConcurrencyCount false', async t => {
	const result = [];

	const queue = new PQueue({
		intervalCap: 1,
		carryoverConcurrencyCount: false,
		interval: 500,
		autoStart: false
	});

	const values = [0, 1];
	values.forEach(value => queue.add(async () => {
		await delay(600);
		result.push(value);
	}));

	queue.start();

	(async () => {
		await delay(550);
		t.is(queue.pending, 2);
		t.deepEqual(result, []);
	})();

	(async () => {
		await delay(650);
		t.is(queue.pending, 1);
		t.deepEqual(result, [0]);
	})();

	await delay(1250);
	t.deepEqual(result, values);
});

test('.add() - throttled, carryoverConcurrencyCount true', async t => {
	const result = [];

	const queue = new PQueue({
		carryoverConcurrencyCount: true,
		intervalCap: 1,
		interval: 500,
		autoStart: false
	});

	const values = [0, 1];
	values.forEach(value => queue.add(async () => {
		await delay(600);
		result.push(value);
	}));

	queue.start();

	(async () => {
		await delay(100);
		t.deepEqual(result, []);
		t.is(queue.pending, 1);
	})();

	(async () => {
		await delay(550);
		t.deepEqual(result, []);
		t.is(queue.pending, 1);
	})();

	(async () => {
		await delay(650);
		t.deepEqual(result, [0]);
		t.is(queue.pending, 0);
	})();

	(async () => {
		await delay(1550);
		t.deepEqual(result, [0]);
	})();

	await delay(1650);
	t.deepEqual(result, [0, 1]);
});

test('.add() - throttled 10, concurrency 5', async t => {
	const result = [];

	const queue = new PQueue({
		concurrency: 5,
		intervalCap: 10,
		interval: 1000,
		autoStart: false
	});

	const firstValue = [...new Array(5).keys()];
	const secondValue = [...new Array(10).keys()];
	const thirdValue = [...new Array(13).keys()];
	thirdValue.forEach(value => queue.add(async () => {
		await delay(300);
		result.push(value);
	}));

	queue.start();

	t.deepEqual(result, []);

	(async () => {
		await delay(400);
		t.deepEqual(result, firstValue);
		t.is(queue.pending, 5);
	})();

	(async () => {
		await delay(700);
		t.deepEqual(result, secondValue);
	})();

	(async () => {
		await delay(1200);
		t.is(queue.pending, 3);
		t.deepEqual(result, secondValue);
	})();

	await delay(1400);
	t.deepEqual(result, thirdValue);
});

test('.add() - throttled finish and resume', async t => {
	const result = [];

	const queue = new PQueue({
		concurrency: 1,
		intervalCap: 2,
		interval: 2000,
		autoStart: false
	});

	const values = [0, 1];
	const firstValue = [0, 1];
	const secondValue = [0, 1, 2];
	values.forEach(value => queue.add(async () => {
		await delay(100);
		result.push(value);
	}));

	queue.start();

	(async () => {
		await delay(1000);
		t.deepEqual(result, firstValue);

		queue.add(async () => {
			await delay(100);
			result.push(2);
		});
	})();

	(async () => {
		await delay(1500);
		t.deepEqual(result, firstValue);
	})();

	await delay(2200);
	t.deepEqual(result, secondValue);
});

test('pause should work when throttled', async t => {
	const result = [];

	const queue = new PQueue({
		concurrency: 2,
		intervalCap: 2,
		interval: 1000,
		autoStart: false
	});

	const values = 	[0, 1, 2, 3];
	const firstValue = 	[0, 1];
	const secondValue = [0, 1, 2, 3];
	values.forEach(value => queue.add(async () => {
		await delay(100);
		result.push(value);
	}));

	queue.start();

	(async () => {
		await delay(300);
		t.deepEqual(result, firstValue);
	})();

	(async () => {
		await delay(600);
		queue.pause();
	})();

	(async () => {
		await delay(1400);
		t.deepEqual(result, firstValue);
	})();

	(async () => {
		await delay(1500);
		queue.start();
	})();

	(async () => {
		await delay(2200);
		t.deepEqual(result, secondValue);
	})();

	await delay(2500);
});

test('clear interval on pause', async t => {
	const queue = new PQueue({
		interval: 100,
		intervalCap: 1
	});

	queue.add(() => {
		queue.pause();
	});

	queue.add(() => 'task #1');

	await delay(300);

	t.is(queue.size, 1);
});

test('should be an event emitter', t => {
	const queue = new PQueue();
	t.true(queue instanceof EventEmitter);
});

test('should emit active event per item', async t => {
	const items = [0, 1, 2, 3, 4];
	const queue = new PQueue();

	let eventCount = 0;
	queue.on('active', () => {
		eventCount++;
	});

	for (const item of items) {
		queue.add(() => item);
	}

	await queue.onIdle();

	t.is(eventCount, items.length);
});
