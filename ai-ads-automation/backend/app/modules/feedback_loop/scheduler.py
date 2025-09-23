"""
Scheduler for running feedback loop jobs.
"""

import asyncio
from datetime import datetime, time
from typing import Optional
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.core.database import SessionLocal
from app.modules.feedback_loop.feedback_service import FeedbackService


class FeedbackScheduler:
    """Scheduler for running feedback loop jobs at regular intervals."""

    def __init__(self, feedback_service: Optional[FeedbackService] = None):
        self.feedback_service = feedback_service if feedback_service else FeedbackService()
        self.running = False
        self.task: Optional[asyncio.Task] = None
        logger.info("FeedbackScheduler initialized")

    async def start(self):
        """Start the scheduler."""
        if self.running:
            logger.warning("Scheduler is already running")
            return
        
        self.running = True
        self.task = asyncio.create_task(self._run_scheduler())
        logger.info("Feedback scheduler started")

    async def stop(self):
        """Stop the scheduler."""
        if not self.running:
            logger.warning("Scheduler is not running")
            return
        
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Feedback scheduler stopped")

    async def _run_scheduler(self):
        """Main scheduler loop."""
        while self.running:
            try:
                current_time = datetime.now().time()
                
                # Run nightly winner job at 2 AM
                if current_time.hour == 2 and current_time.minute == 0:
                    await self._run_nightly_winner_job()
                
                # Sleep for 1 minute before checking again
                await asyncio.sleep(60)
                
            except asyncio.CancelledError:
                logger.info("Scheduler task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}", exc_info=True)
                await asyncio.sleep(60)  # Wait before retrying

    async def _run_nightly_winner_job(self):
        """Run the nightly winner identification job."""
        logger.info("Running scheduled nightly winner job")
        
        try:
            # Create a new database session for the job
            db = SessionLocal()
            try:
                stats = self.feedback_service.nightly_winner_job(db)
                logger.info(f"Nightly winner job completed successfully. Stats: {stats}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error running nightly winner job: {e}", exc_info=True)

    async def run_job_now(self, job_name: str) -> bool:
        """
        Run a specific job immediately.
        
        Args:
            job_name: Name of the job to run
            
        Returns:
            bool: True if job ran successfully
        """
        try:
            if job_name == "nightly_winner":
                await self._run_nightly_winner_job()
                return True
            else:
                logger.error(f"Unknown job name: {job_name}")
                return False
        except Exception as e:
            logger.error(f"Error running job {job_name}: {e}", exc_info=True)
            return False

    def get_status(self) -> dict:
        """
        Get the current status of the scheduler.
        
        Returns:
            dict: Scheduler status information
        """
        return {
            "running": self.running,
            "task_running": self.task is not None and not self.task.done() if self.task else False,
            "current_time": datetime.now().isoformat()
        }


# Global scheduler instance
_scheduler: Optional[FeedbackScheduler] = None


def get_scheduler() -> FeedbackScheduler:
    """Get the global scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = FeedbackScheduler()
    return _scheduler


async def start_feedback_scheduler():
    """Start the global feedback scheduler."""
    scheduler = get_scheduler()
    await scheduler.start()


async def stop_feedback_scheduler():
    """Stop the global feedback scheduler."""
    scheduler = get_scheduler()
    await scheduler.stop()



