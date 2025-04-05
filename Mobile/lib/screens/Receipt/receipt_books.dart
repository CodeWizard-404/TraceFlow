import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/auth_provider.dart';
import 'package:TraceFlow/providers/receipt_book_provider.dart';
import 'package:TraceFlow/widgets/appbar/app_bar.dart';
import 'package:TraceFlow/widgets/commen/progress_indicator.dart';
import '../../widgets/Receipt/Controller.dart';
import '../../widgets/Receipt/FilterSortHeader.dart';
import '../../widgets/Receipt/card.dart';
import '../../widgets/appbar/sidebar.dart';

class ReceiptBooksScreen extends StatefulWidget {
  const ReceiptBooksScreen({super.key});

  @override
  State<ReceiptBooksScreen> createState() => _ReceiptBooksScreenState();
}

class _ReceiptBooksScreenState extends State<ReceiptBooksScreen> {
  late Future<void> _fetchFuture;

  @override
  void initState() {
    super.initState();
    _fetchFuture = Future(() {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _fetchReceiptBooks();
      });
    });
  }

  Future<void> _fetchReceiptBooks() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
    await receiptBookProvider.fetchAndFilterReceiptBooksByHolder(
      authProvider.user!.userID!,
      authProvider.token!,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(title: 'Receipt Books', showBackButton: true),
      drawer: const AppSidebar(), // Add the sidebar here
      body: Builder( // Wrap body in Builder for correct Scaffold context
        builder: (BuildContext scaffoldContext) {
          return FutureBuilder(
            future: _fetchFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CustomProgressIndicator());
              if (snapshot.hasError) return Center(child: Text('Error: ${snapshot.error}'));

              return Consumer2<ReceiptBookProvider, AuthProvider>(
                builder: (context, receiptBookProvider, authProvider, child) {
                  if (receiptBookProvider.isLoading) return const Center(child: CustomProgressIndicator());
                  return ReceiptBookController(
                    books: receiptBookProvider.receiptBooks,
                    child: Builder(builder: (context) {
                      final scope = ReceiptBookScope.of(context);
                      final filteredBooks = scope.filteredBooks;
                      return RefreshIndicator(
                        onRefresh: _fetchReceiptBooks,
                        child: Column(
                          children: [
                            FilterSortHeader(
                              searchController: scope.searchController,
                              onSort: scope.showSortMenu,
                              onFilter: () {},
                              typeOptions: receiptBookProvider.receiptBooks.map((b) => b.type).toSet(),
                              initialFilters: scope.filters,
                              onApplyFilters: (filters) => scope.setFilters(filters),
                            ),
                            Expanded(
                              child: ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                                itemCount: filteredBooks.isEmpty ? 1 : filteredBooks.length,
                                itemBuilder: (context, index) {
                                  if (filteredBooks.isEmpty) {
                                    return const Center(
                                      child: Padding(
                                        padding: EdgeInsets.all(16.0),
                                        child: Text('No receipt books found.'),
                                      ),
                                    );
                                  }
                                  return ReceiptBookCard(book: filteredBooks[index]);
                                },
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}