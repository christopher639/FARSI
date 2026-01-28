from pathlib import Path

from src.ml.predictive_analytics import train_predictive_model
from src.nlp.nlp_pipeline import train_text_classifier


if __name__ == "__main__":
    data_path = Path("crime_in_la.csv")

    print("Training predictive analytics model...")
    result = train_predictive_model(data_path)
    print(result.report)
    print(f"Model saved to: {result.model_path}")

    print("Training NLP text classifier...")
    nlp_result = train_text_classifier(data_path)
    print(nlp_result.report)
    print(f"NLP model saved to: {nlp_result.model_path}")
