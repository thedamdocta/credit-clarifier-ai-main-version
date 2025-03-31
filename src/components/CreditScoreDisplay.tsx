
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GaugeCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CreditScore {
  score: number;
  range: string;
  provider: string;
  date: string;
}

interface CreditScoreDisplayProps {
  scores: CreditScore[];
  hideDisplay?: boolean;
}

const CreditScoreDisplay: React.FC<CreditScoreDisplayProps> = ({ scores, hideDisplay = true }) => {
  // If hideDisplay is true or there are no scores, don't render anything
  if (hideDisplay || scores.length === 0) {
    return null;
  }

  // Function to determine the color based on the score
  const getColor = (score: number) => {
    if (score >= 700) return "text-green-500";
    if (score >= 600) return "text-yellow-500";
    return "text-red-500";
  };

  // Function to determine the description based on the score
  const getDescription = (score: number) => {
    if (score >= 700) return "Excellent";
    if (score >= 600) return "Good";
    return "Fair";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <GaugeCircle className="mr-2 h-5 w-5" />
          Credit Scores
        </CardTitle>
        <CardDescription>Your credit scores from various bureaus</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {scores.map((score, index) => {
          const value = Math.min(100, Math.max(0, (score.score - 300) / 5.5));
          const color = getColor(score.score);
          const description = getDescription(score.score);
          const className = "w-full h-2 rounded-full";

          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">{score.provider} Score</p>
                  <p className="text-sm text-muted-foreground">
                    {score.date}
                  </p>
                </div>
                <div className="flex items-baseline space-x-2">
                  <p className={`text-2xl font-semibold leading-none ${color}`}>{score.score}</p>
                  <p className="text-sm text-muted-foreground">({description})</p>
                </div>
              </div>
              <Progress value={value} className={className} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CreditScoreDisplay;
