import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Car,
  CircleEllipsis,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  PartyPopper,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Tag,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from './supabase';
import type { Tables } from './database.types';

export type Category = Tables<'categories'>;

// Mapa explícito (em vez de importar todos os ícones) para manter o bundle pequeno
const icons: Record<string, LucideIcon> = {
  house: House,
  'shopping-cart': ShoppingCart,
  utensils: Utensils,
  car: Car,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  'party-popper': PartyPopper,
  repeat: Repeat,
  'shopping-bag': ShoppingBag,
  receipt: Receipt,
  'circle-ellipsis': CircleEllipsis,
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendingUp,
};

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && icons[name]) || Tag;
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
