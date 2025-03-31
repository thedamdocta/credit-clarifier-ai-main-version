
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditScore } from "@/lib/creditReportParser";
import { Award, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CreditScoreDisplayProps {
  scores: CreditScore[];
}

const CreditScoreDisplay: React.FC<CreditScoreDisplayProps> = ({ scores }) => {
  if (!scores || scores.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Award className="mr-2 h-5 w-5" />
            Credit Score
          </CardTitle>
          <CardDescription>
            Credit score information not found in the report
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No score data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getScoreCategory = (score: number) => {
    if (score >= 740) return { category: "Excellent", class: "credit-score-high" };
    if (score >= 670) return { category: "Good", class: "credit-score-high" };
    if (score >= 580) return { category: "Fair", class: "credit-score-medium" };
    return { category: "Poor", class: "credit-score-low" };
  };

  const getScorePercentage = (score: number) => {
    // Calculate percentage based on standard FICO range (300-850)
    const min = 300;
    const max = 850;
    const range = max - min;
    const adjusted = score - min;
    return Math.round((adjusted / range) * 100);
  };

  const getProgressColor = (score: number) => {
    if (score >= 740) return "bg-credit-green";
    if (score >= 670) return "bg-credit-indigo";
    if (score >= 580) return "bg-credit-yellow";
    return "bg-credit-red";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Award className="mr-2 h-5 w-5" />
          Credit Score
        </CardTitle>
        <CardDescription>
          Your current credit score information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {scores.map((scoreData, index) => {
          const { category, class: categoryClass } = getScoreCategory(scoreData.score);
          const percentage = getScorePercentage(scoreData.score);
          const progressColor = getProgressColor(scoreData.score);

          return (
            <div key={index} className="space-y-4">
              <div className="flex justify-between items-baseline">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {scoreData.provider} Score
                  </p>
                  <h3 className={`text-4xl font-bold ${categoryClass}`}>
                    {scoreData.score}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">Rating</p>
                  <p className={`font-medium ${categoryClass}`}>{category}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Progress 
                  value={percentage} 
                  className="h-2"
                  indicatorClassName={progressColor}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Poor</span>
                  <span>Fair</span>
                  <span>Good</span>
                  <span>Excellent</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Report date: {scoreData.date}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CreditScoreDisplay;
