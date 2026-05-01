// ErrorBoundary component for catching and displaying runtime errors
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "משהו השתבש. אנא נסה שוב מאוחר יותר.";
      
      if (this.state.error?.message) {
        errorMessage = `שגיאה: ${this.state.error.message}`;
        // Detect common Firebase/Firestore errors if possible
        if (this.state.error.message.includes("permissions")) {
          errorMessage = "אין לך הרשאות מתאימות לביצוע פעולה זו.";
        }
      }

      return (
        <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white p-8 rounded-[32px] shadow-xl border border-[#141414]/5 max-w-md w-full text-center font-sans">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-600 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-[#141414]">אופס! אירעה שגיאה</h2>
            <p className="text-[#141414]/60 mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={this.handleReset}
              className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              <RefreshCw className="w-5 h-5" />
              טען מחדש
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
