import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RANK_GRADIENTS, RANK_GLOW } from "./ranks";

type Props = {
  rank: string;
  division: string;
  size?: number;
};

export function RankBadge({ rank, division, size = 80 }: Props) {
  const grad = RANK_GRADIENTS[rank] || RANK_GRADIENTS.Cuivre;
  const glow = RANK_GLOW[rank] || RANK_GLOW.Cuivre;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        shadowColor: glow,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: size / 4,
        elevation: 10,
      }}
    >
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View style={[styles.inner, { borderRadius: (size - 8) / 2 }]}>
          <Text style={[styles.division, { fontSize: size * 0.32 }]}>{division}</Text>
          <Text style={[styles.rank, { fontSize: size * 0.13 }]} numberOfLines={1}>
            {rank.toUpperCase()}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  inner: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  division: {
    color: "#fff",
    fontWeight: "900",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  rank: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 3,
  },
});
