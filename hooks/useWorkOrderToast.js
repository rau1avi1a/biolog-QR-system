// hooks/useWorkOrderToast.js - Work order specific toast helpers using your existing toast system
import { useToast } from '@/hooks/use-toast'; // Fixed import path
import { CheckCircle, AlertCircle, Clock, Package } from 'lucide-react';

export const useWorkOrderToast = () => {
  const { toast } = useToast();

  const workOrderCreated = (workOrderNumber) => {
    toast({
      title: "Work Order Created!",
      description: `NetSuite WO: ${workOrderNumber}`,
      variant: "default",
      duration: 6000,
    });
  };

  const workOrderFailed = (error) => {
    toast({
      title: "Work Order Failed",
      description: error || "Failed to create work order",
      variant: "destructive",
      duration: 8000,
    });
  };

  const workOrderCreating = () => {
    toast({
      title: "Creating Work Order",
      description: "Work order is being created in NetSuite...",
      variant: "default",
      duration: 3000,
    });
  };

  return {
    workOrderCreated,
    workOrderFailed,
    workOrderCreating
  };
};