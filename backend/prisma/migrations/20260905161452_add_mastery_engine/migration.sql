-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "elo_rating" DOUBLE PRECISION NOT NULL DEFAULT 1200;

-- CreateTable
CREATE TABLE "learner_ratings" (
    "user_id" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 1200,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_ratings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "concept_mastery" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "concept_tag" TEXT NOT NULL,
    "p_mastery" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concept_mastery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concept_mastery_user_id_idx" ON "concept_mastery"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "concept_mastery_user_id_concept_tag_key" ON "concept_mastery"("user_id", "concept_tag");

-- AddForeignKey
ALTER TABLE "learner_ratings" ADD CONSTRAINT "learner_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_mastery" ADD CONSTRAINT "concept_mastery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
