"""Who gets the local model first (D33 latency target).

One Ollama model (and one GPU) serves Mike's replies, speech recognition and the background jobs:
feedback, answer suggestions, stronger versions and the word-timing pass of the recogniser. Mike always
goes first. A background job waits while Mike is busy; if Mike needs the model while a job is running,
the job is cancelled (Ollama stops generating when the request is closed) and run again later.
"""
from __future__ import annotations

import asyncio
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")


class ModelGate:
    def __init__(self, enabled: bool = True, max_preemptions: int = 4) -> None:
        self.enabled = enabled
        self.max_preemptions = max_preemptions
        self._holders = 0
        self._idle = asyncio.Event()
        self._idle.set()
        self._busy = asyncio.Event()
        self.preemptions = 0                     # for tests and benchmarks

    @property
    def busy(self) -> bool:
        return self._holders > 0

    def hold(self) -> None:
        """Mike starts using the model (speech recognition and the reply)."""
        self._holders += 1
        self._idle.clear()
        self._busy.set()

    def release(self) -> None:
        if self._holders == 0:
            return
        self._holders -= 1
        if self._holders == 0:
            self._busy.clear()
            self._idle.set()

    async def background(self, job: Callable[[], Awaitable[T]], *, preemptible: bool = True) -> T:
        """Run `job()` when Mike is not using the model. A preemptible job restarts after Mike's turn;
        after `max_preemptions` restarts it runs to the end so feedback is never starved."""
        if not self.enabled:
            return await job()
        restarts = 0
        while True:
            await self._idle.wait()
            task = asyncio.ensure_future(job())
            if not preemptible or restarts >= self.max_preemptions:
                return await task
            watcher = asyncio.ensure_future(self._busy.wait())
            try:
                done, _ = await asyncio.wait({task, watcher}, return_when=asyncio.FIRST_COMPLETED)
            except asyncio.CancelledError:
                task.cancel()
                raise
            finally:
                watcher.cancel()
            if task in done:
                return task.result()
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            restarts += 1
            self.preemptions += 1
