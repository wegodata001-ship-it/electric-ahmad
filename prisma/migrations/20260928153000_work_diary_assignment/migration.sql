ALTER TYPE "WorkDiaryStatus" ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE "WorkDiaryStatus" ADD VALUE IF NOT EXISTS 'in_progress';

ALTER TYPE "WorkflowStatus" ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE "WorkflowStatus" ADD VALUE IF NOT EXISTS 'in_progress';
