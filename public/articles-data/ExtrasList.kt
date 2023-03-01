package com.example.fhsnews.data

import com.example.fhsnews.model.Article
import java.sql.Date

object ExtrasList {
    val extrasList: List<Article> = listOf(
        // Contains the weather and red/silver card
        // This list is merged at the front of the news list in the NewsCard adapter, but they are
        //  kept separate for the EventsViewAdapter
        // Only the cardType field matters, no other fields here are used
        Article(
            1, 0, 0, Date(0), Date(0), "Weather", 0, "", listOf(), "", "", ""
        ), Article(
            2, 0, 0, Date(0), Date(0), "Red/Silver Indicator", 0, "", listOf(), "", "", ""
        )
    )
}